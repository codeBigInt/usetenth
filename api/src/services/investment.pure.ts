import { dec, percentOf } from "../utils/money";

export const MIN_NOTIONAL_USD = "1.00";

export interface LegOrder {
  asset: string;
  amount: string;
}

/** Splits an investment across a rule's allocations; legs under the minimum notional are skipped, not sent to fail. */
export function planOrders(investmentAmount: string, allocations: { asset: string; percentage: string }[]) {
  const orders: LegOrder[] = [];
  const skipped: LegOrder[] = [];
  for (const a of allocations) {
    const amount = percentOf(investmentAmount, a.percentage);
    (dec(amount).lt(MIN_NOTIONAL_USD) ? skipped : orders).push({ asset: a.asset, amount });
  }
  return { orders, skipped };
}
