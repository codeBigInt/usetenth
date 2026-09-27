import { dec } from "../utils/money";
import { MIN_NOTIONAL_USD } from "./investment.pure";

/** The most the price may move against the user between the quote they saw and the one we execute. */
export const MAX_SLIPPAGE = "0.01";

export function amountProblem(amount: string, maxUsd: string): string | null {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return "Enter an amount in dollars, like 1.00.";
  if (dec(amount).lt(MIN_NOTIONAL_USD)) return `The minimum order is $${MIN_NOTIONAL_USD}.`;
  if (dec(amount).gt(maxUsd)) return `Test buys are limited to $${maxUsd}.`;
  return null;
}

/** True when we would still receive at least (1 - slippage) of the tokens the user was quoted. */
export function withinSlippage(qtyOut: string, previewedQtyOut: string | undefined, slippage = MAX_SLIPPAGE): boolean {
  if (!previewedQtyOut) return true;
  return dec(qtyOut).gte(dec(previewedQtyOut).mul(dec(1).minus(slippage)));
}

/** Dollars per token from what was spent and what was received. */
export const pricePerToken = (spent: string, qty: string) => (dec(qty).gt(0) ? dec(spent).div(qty).toSignificantDigits(8).toFixed() : null);
