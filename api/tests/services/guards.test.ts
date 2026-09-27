import { describe, expect, test, vi } from "vitest";

process.env.MONGODB_URI = "mongodb://test";
process.env.APP_MODE = "demo";
process.env.MAX_ORDER_USD = "2";
process.env.MAX_USER_SPEND_USD = "2";

let spentAmounts: string[] = [];
vi.mock("../../src/models", () => ({ Order: { find: () => ({ select: async () => spentAmounts.map((amount) => ({ amount })) }) } }));

const { assertCanSpend, spendRemaining } = await import("../../src/services/guards");

describe("assertCanSpend", () => {
  test("allows a buy inside the caps", async () => {
    spentAmounts = ["1.00"];
    await expect(assertCanSpend("u", "1.00")).resolves.toBeUndefined();
  });

  test("the spend cap error is readable and says how much was used (it used to surface as a 500)", async () => {
    spentAmounts = ["1.00", "1.00"];
    const caught = await assertCanSpend("u", "1.00").catch((e: unknown) => e);
    expect(caught).toMatchObject({ statusCode: 403 });
    expect((caught as Error).message).toBe("Demo spending limit reached: $2.00 of $2.00 used. Ask the demo owner to raise the limit.");
  });

  test("a per-order breach is readable too", async () => {
    spentAmounts = [];
    const caught = await assertCanSpend("u", "5.00").catch((e: unknown) => e);
    expect(caught).toMatchObject({ statusCode: 422 });
    expect((caught as Error).message).toContain("$2.00 per-order demo limit");
  });
});

describe("spendRemaining", () => {
  test("is the cap minus what is spent, never below zero", async () => {
    spentAmounts = ["1.00"];
    expect(await spendRemaining("u")).toBe("1.00");
    spentAmounts = ["1.00", "1.00", "1.00"];
    expect(await spendRemaining("u")).toBe("0.00");
  });
});
