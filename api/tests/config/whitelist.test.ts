import { describe, expect, test } from "vitest";
import { canonicalTicker } from "../../src/services/assets.service";
import { isStockTickerEligible } from "../../src/config/whitelist";

describe("canonicalTicker", () => {
  test("strips the Coinbase-tokenized 'C' suffix on base", () => {
    expect(canonicalTicker({ chain: "base", symbol: "AAPLC", assetClass: "stock" })).toBe("AAPL");
    expect(canonicalTicker({ chain: "base", symbol: "GOOGLC", assetClass: "stock" })).toBe("GOOGL");
  });

  test("leaves Robinhood-token symbols as-is", () => {
    expect(canonicalTicker({ chain: "robinhood", symbol: "PLTR", assetClass: "stock" })).toBe("PLTR");
    expect(canonicalTicker({ chain: "robinhood", symbol: "AMAT", assetClass: "stock" })).toBe("AMAT");
  });

  test("leaves crypto symbols untouched even if they end in C", () => {
    expect(canonicalTicker({ chain: "solana", symbol: "PYUSD", assetClass: "crypto" })).toBe("PYUSD");
  });
});

describe("isStockTickerEligible", () => {
  test("admits real S&P 500 constituents seen in the live catalog", () => {
    for (const t of ["AAPL", "GOOGL", "TSLA", "PLTR", "AMAT"]) {
      expect(isStockTickerEligible(t)).toBe(true);
    }
  });

  test("rejects a tokenized stock that isn't an S&P 500 member", () => {
    // GameStop (GME) is on the TM catalog as a Robinhood token but isn't in the S&P 500.
    expect(isStockTickerEligible("GME")).toBe(false);
  });

  test("rejects an unknown ticker", () => {
    expect(isStockTickerEligible("NOT_A_REAL_TICKER")).toBe(false);
  });
});
