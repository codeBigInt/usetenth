import { describe, expect, test, vi } from "vitest";

process.env.MONGODB_URI = "mongodb://test";

async function urlWith(vars: Record<string, string>, path = "/tenth") {
  for (const k of ["WEB_APP_URL", "NGROK_TUNNEL_URL"]) delete process.env[k];
  Object.assign(process.env, vars);
  vi.resetModules();
  return (await import("../../src/config/web")).webAppUrl(path);
}

describe("webAppUrl", () => {
  test("uses the ngrok domain when WEB_APP_URL is empty (the regression that dropped every button)", async () => {
    expect(await urlWith({ WEB_APP_URL: "", NGROK_TUNNEL_URL: "demo.ngrok-free.dev" })).toBe("https://demo.ngrok-free.dev/tenth");
  });

  test("accepts the domain with or without https:// and a trailing slash", async () => {
    expect(await urlWith({ NGROK_TUNNEL_URL: "https://demo.ngrok-free.dev/" }, "/buy")).toBe("https://demo.ngrok-free.dev/buy");
  });

  test("WEB_APP_URL wins when set", async () => {
    expect(await urlWith({ WEB_APP_URL: "https://app.example/", NGROK_TUNNEL_URL: "demo.ngrok-free.dev" })).toBe("https://app.example/tenth");
  });

  test("is null only when nothing is configured", async () => {
    expect(await urlWith({})).toBeNull();
  });
});
