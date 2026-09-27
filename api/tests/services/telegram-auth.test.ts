import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { verifyInitData } from "../../src/services/telegram-auth";

const TOKEN = "123456:TEST-token";
const NOW = new Date("2026-09-25T12:00:00Z");
const authDate = Math.floor(NOW.getTime() / 1000);

function sign(fields: Record<string, string>, token = TOKEN): string {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const fields = { auth_date: String(authDate), query_id: "AAH", user: JSON.stringify({ id: 42, first_name: "Ada", username: "ada" }) };

describe("verifyInitData", () => {
  test("accepts a correctly signed payload and returns the user", () => {
    expect(verifyInitData(sign(fields), TOKEN, NOW)).toMatchObject({ id: 42, username: "ada" });
  });

  test("rejects a payload signed with another bot token", () => {
    expect(verifyInitData(sign(fields, "999:other"), TOKEN, NOW)).toBeNull();
  });

  test("rejects tampered data", () => {
    const tampered = sign(fields).replace("%22id%22%3A42", "%22id%22%3A43");
    expect(verifyInitData(tampered, TOKEN, NOW)).toBeNull();
  });

  test("rejects a missing hash", () => {
    expect(verifyInitData("auth_date=1&user=%7B%7D", TOKEN, NOW)).toBeNull();
  });

  test("rejects stale payloads", () => {
    const old = sign({ ...fields, auth_date: String(authDate - 2 * 24 * 60 * 60) });
    expect(verifyInitData(old, TOKEN, NOW)).toBeNull();
  });
});
