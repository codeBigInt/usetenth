import { beforeEach, describe, expect, test, vi } from "vitest";

process.env.MONGODB_URI = "mongodb://test";

const users = new Map<string, Record<string, unknown>>();
let ownerTelegramId: string | null = null;
const writes: unknown[] = [];
vi.mock("../../src/models", () => ({
  Account: { findOne: async () => (ownerTelegramId ? { userId: "owner-id" } : null) },
  User: {
    findById: async () => (ownerTelegramId ? { telegramId: ownerTelegramId } : null),
    findOne: (q: { telegramId: string }) => ({ select: async () => users.get(q.telegramId) ?? null }),
    findOneAndUpdate: async (q: { telegramId: string }, update: Record<string, unknown>) => {
      writes.push(update);
      users.set(q.telegramId, { ...(users.get(q.telegramId) ?? {}), ...update });
    },
  },
}));

async function load(codes?: string) {
  if (codes === undefined) delete process.env.INVITE_CODES;
  else process.env.INVITE_CODES = codes;
  vi.resetModules();
  return import("../../src/services/owner");
}

beforeEach(() => {
  users.clear();
  writes.length = 0;
  ownerTelegramId = "1";
});

describe("invite codes", () => {
  test("match case-insensitively and ignore whitespace; unset means none are valid", async () => {
    const m = await load(" Judge2026 , other ");
    expect(m.isValidInvite("judge2026")).toBe(true);
    expect(m.isValidInvite("  OTHER ")).toBe(true);
    expect(m.isValidInvite("nope")).toBe(false);
    expect(m.isValidInvite("")).toBe(false);
    expect((await load()).isValidInvite("anything")).toBe(false);
  });
});

describe("redeemInvite", () => {
  test("a valid code grants judge access, recorded with the code used", async () => {
    const { redeemInvite, accessOf } = await load("JUDGE");
    expect(await accessOf({ id: 7 })).toBeNull();
    expect(await redeemInvite({ id: 7, username: "j" }, "judge")).toBe("granted");
    expect(await accessOf({ id: 7 })).toBe("judge");
    expect(writes[0]).toMatchObject({ access: "judge", invitedWith: "judge" });
  });

  test("an invalid code grants nothing and writes nothing", async () => {
    const { redeemInvite, accessOf } = await load("JUDGE");
    expect(await redeemInvite({ id: 7 }, "wrong")).toBe("invalid");
    expect(await accessOf({ id: 7 })).toBeNull();
    expect(writes).toHaveLength(0);
  });

  test("the owner keeps owner access and is never downgraded to judge", async () => {
    const { redeemInvite, accessOf } = await load("JUDGE");
    expect(await redeemInvite({ id: 1 }, "JUDGE")).toBe("owner");
    expect(await accessOf({ id: 1 })).toBe("owner");
    expect(writes).toHaveLength(0);
  });

  test("without any invite codes configured, nobody can get in", async () => {
    const { redeemInvite } = await load();
    expect(await redeemInvite({ id: 7 }, "JUDGE")).toBe("invalid");
  });
});
