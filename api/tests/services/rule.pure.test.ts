import { describe, expect, test } from "vitest";
import type { InvestableAsset } from "../../src/services/assets.service";
import { planOrders } from "../../src/services/investment.pure";
import { equalPercentages, resolvePicks } from "../../src/services/rule.pure";

const asset = (assetKey: string, ticker: string): InvestableAsset => ({ assetKey, symbol: ticker, ticker, displayName: ticker, kind: "equity", venue: "defi" });
const investable = [asset("base:0xaaa", "AAPL"), asset("robinhood:0xbbb", "AAPL"), asset("robinhood:0xccc", "PLTR"), asset("cefi:BTC", "BTC")];

describe("resolvePicks", () => {
  test("a ticker resolves to an investable asset, preferring Coinbase's listing", () => {
    expect(resolvePicks([{ ticker: "aapl" }], investable).resolved.map((a) => a.assetKey)).toEqual(["base:0xaaa"]);
  });

  test("a specific assetKey wins over the ticker", () => {
    expect(resolvePicks([{ assetKey: "robinhood:0xbbb", ticker: "AAPL" }], investable).resolved[0]?.assetKey).toBe("robinhood:0xbbb");
  });

  test("unavailable picks are reported, not silently dropped", () => {
    const r = resolvePicks([{ ticker: "PLTR" }, { ticker: "NFLX" }, { assetKey: "base:0xgone" }], investable);
    expect(r.resolved.map((a) => a.ticker)).toEqual(["PLTR"]);
    expect(r.skipped).toEqual(["NFLX", "base:0xgone"]);
  });

  test("the same asset picked twice is counted once", () => {
    expect(resolvePicks([{ ticker: "PLTR" }, { assetKey: "robinhood:0xccc" }], investable).resolved).toHaveLength(1);
  });
});

describe("equalPercentages", () => {
  test("always sums to exactly 100.00", () => {
    for (let n = 1; n <= 20; n++) {
      const total = equalPercentages(n).reduce((a, p) => a + Math.round(Number(p) * 100), 0);
      expect(total).toBe(10000);
    }
  });

  test("uneven counts hand the extra cents to the first assets", () => {
    expect(equalPercentages(3)).toEqual(["33.34", "33.33", "33.33"]);
    expect(equalPercentages(2)).toEqual(["50.00", "50.00"]);
    expect(equalPercentages(0)).toEqual([]);
  });
});

describe("planOrders", () => {
  const two = [{ asset: "a", percentage: "50.00" }, { asset: "b", percentage: "50.00" }];

  test("splits the investment across allocations", () => {
    expect(planOrders("2.00", two)).toEqual({ orders: [{ asset: "a", amount: "1.00" }, { asset: "b", amount: "1.00" }], skipped: [] });
  });

  test("legs below the $1.00 minimum are skipped rather than sent to fail", () => {
    const eight = equalPercentages(8).map((percentage, i) => ({ asset: `s${i}`, percentage }));
    const r = planOrders("2.00", eight);
    expect(r.orders).toEqual([]);
    expect(r.skipped).toHaveLength(8);
  });

  test("a mix that fits the amount is fully ordered", () => {
    const r = planOrders("8.00", equalPercentages(8).map((percentage, i) => ({ asset: `s${i}`, percentage })));
    expect(r.orders).toHaveLength(8);
    expect(r.skipped).toHaveLength(0);
  });
});
