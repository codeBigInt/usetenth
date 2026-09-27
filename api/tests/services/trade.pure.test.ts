import { describe, expect, test } from "vitest";
import { amountProblem, pricePerToken, withinSlippage } from "../../src/services/trade.pure";

describe("amountProblem", () => {
  test("accepts dollar amounts inside the limits", () => {
    expect(amountProblem("1.00", "2")).toBeNull();
    expect(amountProblem("2", "2")).toBeNull();
  });

  test("rejects junk, sub-minimum and over-limit amounts", () => {
    expect(amountProblem("abc", "2")).toContain("dollars");
    expect(amountProblem("-1", "2")).toContain("dollars");
    expect(amountProblem("1.005", "2")).toContain("dollars");
    expect(amountProblem("0.99", "2")).toContain("minimum");
    expect(amountProblem("2.01", "2")).toContain("limited to $2");
  });
});

describe("withinSlippage", () => {
  test("allows up to 1% fewer tokens than quoted", () => {
    expect(withinSlippage("0.00293", "0.00293")).toBe(true);
    expect(withinSlippage("0.9900", "1.0000")).toBe(true);
    expect(withinSlippage("0.9899", "1.0000")).toBe(false);
  });

  test("more tokens than quoted is always fine; no previewed quote means no check", () => {
    expect(withinSlippage("1.5", "1.0")).toBe(true);
    expect(withinSlippage("0.0001", undefined)).toBe(true);
  });
});

describe("pricePerToken", () => {
  test("derives the dollar price from spend and quantity", () => {
    expect(pricePerToken("1.00", "0.00293218")).toBe("341.04318");
    expect(pricePerToken("1.00", "0")).toBeNull();
  });
});
