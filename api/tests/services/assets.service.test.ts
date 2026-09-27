import { describe, expect, test } from "vitest";
import type { Basket } from "../../src/config/baskets";
import { dec } from "../../src/utils/money";
import { rebalancedSplit, split } from "../../src/services/assets.service";

function randomBasket(n: number): Basket {
  const raw = Array.from({ length: n }, () => Math.random());
  const total = raw.reduce((a, b) => a + b, 0);
  const weightsAsFloats = raw.map((r) => r / total);
  // Normalize to decimal strings that sum to exactly 1 (largest-remainder on the weights themselves).
  const cents = weightsAsFloats.map((w) => Math.round(w * 10_000));
  const drift = 10_000 - cents.reduce((a, b) => a + b, 0);
  cents[0] = (cents[0] ?? 0) + drift;
  return {
    name: "random",
    description: "",
    weights: cents.map((c, i) => ({ assetKey: `asset-${i}`, weight: (c / 10_000).toString() })),
  };
}

describe("split", () => {
  test("sums to the input amount across 100 random weight sets", () => {
    for (let i = 0; i < 100; i++) {
      const basket = randomBasket(2 + (i % 4)); // 2..5 assets
      const allocations = split("80.00", basket);
      const total = allocations.reduce((a, x) => a.plus(x.amount), dec(0));
      expect(total.toFixed(2)).toBe("80.00");
    }
  });

  test("uneven thirds still re-add exactly", () => {
    const basket: Basket = {
      name: "thirds",
      description: "",
      weights: [
        { assetKey: "a", weight: "0.3333333333" },
        { assetKey: "b", weight: "0.3333333333" },
        { assetKey: "c", weight: "0.3333333334" },
      ],
    };
    const allocations = split("10.00", basket);
    const total = allocations.reduce((a, x) => a.plus(x.amount), dec(0));
    expect(total.toFixed(2)).toBe("10.00");
  });
});

describe("rebalancedSplit", () => {
  const basket: Basket = {
    name: "steady",
    description: "",
    weights: [
      { assetKey: "cefi:BTC", weight: "0.5" },
      { assetKey: "cefi:ETH", weight: "0.5" },
    ],
  };

  test("biases new money toward the underweight asset", () => {
    // Portfolio is all BTC so far; new cash should go entirely to ETH to close the gap.
    const allocations = rebalancedSplit("10.00", basket, { "cefi:BTC": "100", "cefi:ETH": "0" });
    const byKey = Object.fromEntries(allocations.map((a) => [a.assetKey, a.amount]));
    expect(byKey["cefi:ETH"]).toBe("10.00");
    expect(byKey["cefi:BTC"]).toBe("0.00");
  });

  test("falls back to target weights when already balanced", () => {
    const allocations = rebalancedSplit("10.00", basket, { "cefi:BTC": "50", "cefi:ETH": "50" });
    const byKey = Object.fromEntries(allocations.map((a) => [a.assetKey, a.amount]));
    expect(byKey["cefi:BTC"]).toBe("5.00");
    expect(byKey["cefi:ETH"]).toBe("5.00");
  });

  test("still re-adds to the input amount exactly with no prior positions", () => {
    const allocations = rebalancedSplit("10.00", basket, {});
    const total = allocations.reduce((a, x) => a.plus(x.amount), dec(0));
    expect(total.toFixed(2)).toBe("10.00");
  });
});
