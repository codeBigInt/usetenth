import { describe, expect, test } from "vitest";
import type { Basket } from "../../src/config/baskets";
import { dec } from "../../src/utils/money";
import { isUsMarketOpen, plan, type PlanInput, type RuleConfig } from "../../src/services/rule-engine";

const steady: Basket = {
  name: "steady",
  description: "",
  weights: [
    { assetKey: "cefi:BTC", weight: "0.5" },
    { assetKey: "cefi:ETH", weight: "0.5" },
  ],
};

const baseRule: RuleConfig = { percent: "10", minBatch: "10.00", holdWeekends: true, paused: false };
const bothInvestable = new Set(["cefi:BTC", "cefi:ETH"]);

// A known weekday, market-open moment in UTC (2026-09-24 is a Thursday).
const weekdayOpen = new Date("2026-09-24T15:00:00Z");
const saturday = new Date("2026-09-26T15:00:00Z");

function baseInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    userId: "user-1",
    pendingBatchId: "batch-1",
    deposit: "100.00",
    rule: baseRule,
    basket: steady,
    investableKeys: bothInvestable,
    positionValues: {},
    pendingBefore: "0.00",
    clock: weekdayOpen,
    ...overrides,
  };
}

describe("plan", () => {
  test("below minimum: money accumulates, nothing is sent", () => {
    const result = plan(baseInput({ deposit: "50.00", rule: { ...baseRule, percent: "10", minBatch: "10.00" } }));
    // tenth = 5.00, below the 10.00 min batch
    expect(result.reason).toBe("below_minimum");
    expect(result.intents).toEqual([]);
    expect(result.pendingAfter).toBe("5.00");
  });

  test("weekend hold: schedules for next open, no intents sent", () => {
    const result = plan(baseInput({ clock: saturday }));
    expect(result.reason).toBe("weekend_hold");
    expect(result.intents).toEqual([]);
  });

  test("paused: nothing is taken, full deposit stays the user's", () => {
    const result = plan(baseInput({ rule: { ...baseRule, paused: true } }));
    expect(result.reason).toBe("paused");
    expect(result.residual).toBe("100.00");
    expect(result.tenth).toBe("0.00");
    expect(result.intents).toEqual([]);
  });

  test("basket with an unavailable asset: that leg folds back into pending", () => {
    const result = plan(baseInput({ investableKeys: new Set(["cefi:BTC"]) }));
    expect(result.reason).toBe("executed");
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]?.assetKey).toBe("cefi:BTC");
    // tenth = 10.00; ETH leg (5.00) is unavailable and folds back into pending
    expect(result.pendingAfter).toBe("5.00");
  });

  test("uneven deposit splits without losing a cent", () => {
    const result = plan(baseInput({ deposit: "333.30" })); // tenth = 33.33, an uneven amount to split
    expect(result.reason).toBe("executed");
    const sumIntents = result.intents.reduce((a, i) => a.plus(i.amount), dec(0));
    // pendingBefore is 0, so tenth === sum(intents) + whatever's folded back into pending
    expect(sumIntents.plus(result.pendingAfter).toFixed(2)).toBe(result.tenth);
  });

  test("invariant: intents + folded-back remainder always equal the tenth", () => {
    for (const deposit of ["100.00", "37.51", "999.99", "10.00"]) {
      const result = plan(baseInput({ deposit }));
      if (result.reason !== "executed") continue;
      const sumIntents = result.intents.reduce((a, i) => a.plus(i.amount), dec(0));
      expect(sumIntents.plus(result.pendingAfter).toFixed(2)).toBe(result.tenth);
      expect(dec(result.residual).plus(result.tenth).toFixed(2)).toBe(dec(deposit).toFixed(2));
    }
  });

  test("cash-flow rebalance biases toward the underweight leg", () => {
    const result = plan(baseInput({ positionValues: { "cefi:BTC": "1000", "cefi:ETH": "0" } }));
    const eth = result.intents.find((i) => i.assetKey === "cefi:ETH");
    const btc = result.intents.find((i) => i.assetKey === "cefi:BTC");
    expect(dec(eth?.amount ?? "0").gt(btc?.amount ?? "0")).toBe(true);
  });
});

describe("isUsMarketOpen", () => {
  test("closed on weekends", () => {
    expect(isUsMarketOpen(saturday)).toBe(false);
  });

  test("open on a weekday during market hours", () => {
    expect(isUsMarketOpen(weekdayOpen)).toBe(true);
  });

  test("closed before the open", () => {
    expect(isUsMarketOpen(new Date("2026-09-24T09:00:00Z"))).toBe(false);
  });
});
