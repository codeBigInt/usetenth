import { expect, test } from "vitest";
import { applyFill } from "../../src/services/ledger.service";

const zero = { quantity: "0", costTotal: "0", realizedGain: "0" };

test("buys accumulate quantity and cost", () => {
  const a = applyFill(zero, { side: "buy", quantity: "2", price: "10" });
  const b = applyFill(a, { side: "buy", quantity: "2", price: "20" });
  expect(b.quantity).toBe("4");
  expect(b.costTotal).toBe("60");
});

test("sell reduces cost proportionally and books gain", () => {
  const a = applyFill(zero, { side: "buy", quantity: "4", price: "15" }); // cost 60
  const b = applyFill(a, { side: "sell", quantity: "1", price: "20" });
  expect(b.quantity).toBe("3");
  expect(b.costTotal).toBe("45");
  expect(b.realizedGain).toBe("5");
});

test("cannot oversell", () => {
  expect(() => applyFill(zero, { side: "sell", quantity: "1", price: "1" })).toThrow();
});

test("a known notional is the cost, so rounding in the price never leaks into the cost basis", () => {
  const price = "341.04202"; // 1 / 0.00293219, rounded
  const viaPrice = applyFill(zero, { side: "buy", quantity: "0.00293219", price });
  expect(viaPrice.costTotal).not.toBe("1");
  const exact = applyFill(zero, { side: "buy", quantity: "0.00293219", price, notional: "1.00" });
  expect(exact.costTotal).toBe("1");
});
