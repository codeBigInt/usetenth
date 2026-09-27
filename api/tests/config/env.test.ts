import { describe, expect, test } from "vitest";
process.env.MONGODB_URI = "mongodb://test";
const { parseEnv, withoutEmpty } = await import("../../src/config/env");

const base = { MONGODB_URI: "mongodb://test" };

describe("env", () => {
  test("an empty value is the same as unset, so `KEY=` in .env cannot shadow a fallback", () => {
    const env = parseEnv({ ...base, WEB_APP_URL: "", NGROK_AUTHTOKEN: "", INVITE_CODES: "", ADMIN_API_KEY: "" });
    expect(env.WEB_APP_URL).toBeUndefined();
    expect(env.NGROK_AUTHTOKEN).toBeUndefined();
    expect(env.INVITE_CODES).toBeUndefined();
    expect(env.ADMIN_API_KEY).toBeUndefined();
  });

  test("an empty value falls back to the default instead of failing or becoming empty", () => {
    const env = parseEnv({ ...base, PORT: "", TEST_BUY_ENABLED: "", TEST_BUY_MAX_USD: "", DEPOSIT_DEFAULT_NETWORK: "" });
    expect(env.PORT).toBe(3000);
    expect(env.TEST_BUY_ENABLED).toBe(false);
    expect(env.TEST_BUY_MAX_USD).toBe("2");
    expect(env.DEPOSIT_DEFAULT_NETWORK).toBe("solana");
  });

  test("real values are kept", () => {
    const env = parseEnv({ ...base, WEB_APP_URL: "https://app.example", TEST_BUY_ENABLED: "true", ADMIN_API_KEY: "k" });
    expect(env.WEB_APP_URL).toBe("https://app.example");
    expect(env.TEST_BUY_ENABLED).toBe(true);
    expect(env.ADMIN_API_KEY).toBe("k");
  });

  test("withoutEmpty drops only empty and undefined entries", () => {
    expect(withoutEmpty({ A: "1", B: "", C: undefined })).toEqual({ A: "1" });
  });
});
