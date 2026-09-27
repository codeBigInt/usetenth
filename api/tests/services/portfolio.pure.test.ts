import { describe, expect, test } from "vitest";
import { toOrderTarget } from "../../src/services/assets.service";
import { buildPortfolio, type BalanceRow } from "../../src/services/portfolio.pure";

const pyusd: BalanceRow = { symbol: "PYUSD", chain: "solana", address: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", total: "50", available: "50", stable: true };
const aapl: BalanceRow = { symbol: "AAPLC", name: "Apple", chain: "base", address: "0xB200000000000000000000C2E324D24D7EECD1FB", total: "0.5", available: "0.5", stable: false };
const key = "base:0xb200000000000000000000c2e324d24d7eecd1fb";

describe("buildPortfolio", () => {
  test("cash only: nothing invested yet", () => {
    const p = buildPortfolio([pyusd], {}, {}, "PYUSD");
    expect(p).toMatchObject({ cash: "50.00", holdings: [], invested: "0.00", value: "0.00", gain: null });
  });

  test("values a holding from price and computes gain against ledger cost", () => {
    const p = buildPortfolio([pyusd, aapl], { [key]: "100" }, { [key]: "230.5" }, "PYUSD");
    expect(p.holdings[0]).toMatchObject({ symbol: "AAPLC", quantity: "0.5", cost: "100", price: "230.5", value: "115.25" });
    expect(p).toMatchObject({ cash: "50.00", invested: "100.00", value: "115.25", gain: "15.25" });
  });

  test("no price means no invented gain", () => {
    const p = buildPortfolio([aapl], { [key]: "100" }, { [key]: null }, "PYUSD");
    expect(p.holdings[0]?.value).toBeNull();
    expect(p.value).toBe("100.00");
    expect(p.gain).toBeNull();
  });

  test("a held asset with no ledger cost has no gain either", () => {
    const p = buildPortfolio([aapl], {}, { [key]: "230.5" }, "PYUSD");
    expect(p.holdings[0]?.cost).toBeNull();
    expect(p.gain).toBeNull();
  });
});

describe("toOrderTarget", () => {
  test("defi assets use the original-case address and chain", () => {
    expect(toOrderTarget({ venue: "defi", symbol: "PYUSD", chain: "solana", address: pyusd.address })).toEqual({ baseAsset: pyusd.address, chain: "solana" });
  });

  test("cefi assets use the symbol and no chain", () => {
    expect(toOrderTarget({ venue: "cefi", symbol: "BTC" })).toEqual({ baseAsset: "BTC" });
  });
});
