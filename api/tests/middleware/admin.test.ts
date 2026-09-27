import { describe, expect, test, vi } from "vitest";

process.env.MONGODB_URI = "mongodb://test";

vi.mock("../../src/services/owner", () => ({ hasDemoAccess: async () => false }));

async function load(key?: string) {
  if (key === undefined) delete process.env.ADMIN_API_KEY;
  else process.env.ADMIN_API_KEY = key;
  vi.resetModules();
  return import("../../src/middleware");
}
const req = (header?: string) => ({ header: (n: string) => (n.toLowerCase() === "x-admin-key" ? header : undefined) }) as never;

describe("requireAdminKey", () => {
  test("is closed when no key is configured, so an unset env never opens the routes", async () => {
    const { requireAdminKey } = await load();
    const next = vi.fn();
    expect(() => requireAdminKey(req("anything"), {} as never, next)).toThrow("not configured");
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a missing, wrong or different-length key", async () => {
    const { requireAdminKey } = await load("s3cret-key-value");
    const next = vi.fn();
    for (const bad of [undefined, "", "wrong", "s3cret-key-valuX", "s3cret-key-value-and-more"]) {
      expect(() => requireAdminKey(req(bad), {} as never, next)).toThrow("Invalid admin key");
    }
    expect(next).not.toHaveBeenCalled();
  });

  test("lets the right key through", async () => {
    const { requireAdminKey } = await load("s3cret-key-value");
    const next = vi.fn();
    requireAdminKey(req("s3cret-key-value"), {} as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("requireDemoAccess", () => {
  const res = (tg?: object) => ({ locals: { telegramUser: tg } }) as never;

  test("needs a verified Telegram user", async () => {
    const { requireDemoAccess } = await load("k");
    await expect(requireDemoAccess({} as never, res(), vi.fn())).rejects.toThrow("Open usetenth from Telegram");
  });

  test("refuses a verified user who has no access, pointing them to an invite", async () => {
    const { requireDemoAccess } = await load("k");
    await expect(requireDemoAccess({} as never, res({ id: 9 }), vi.fn())).rejects.toThrow("invite-only");
  });
});
