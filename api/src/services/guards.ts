import { env } from "../config/env";
import { Order } from "../models";
import { dec, usd } from "../utils/money";
import AppError from "./error";
import { withinSpendCap } from "./guards.pure";

/** Sum of a user's non-failed order amounts (what has been or will be spent). */
export async function userSpent(userId: string): Promise<string> {
  const orders = await Order.find({
    userId,
    side: "buy",
    status: { $nin: ["failed", "rejected_slippage", "canceled"] },
  }).select("amount");
  return orders.reduce((a, o) => a.plus(o.amount), dec(0)).toFixed();
}

/** What a user may still spend under the demo cap, or null when caps are off (live mode). */
export async function spendRemaining(userId: string): Promise<string | null> {
  if (env.APP_MODE !== "demo") return null;
  const left = dec(env.MAX_USER_SPEND_USD).minus(await userSpent(userId));
  return (left.isNegative() ? dec(0) : left).toFixed(2);
}

/** Throws a readable error if an order would break a demo-mode guard. No-op in live mode. */
export async function assertCanSpend(userId: string, amount: string) {
  if (env.APP_MODE !== "demo") return;
  if (dec(amount).gt(env.MAX_ORDER_USD)) throw new AppError(422, `That is more than the ${usd(env.MAX_ORDER_USD)} per-order demo limit.`);
  const spent = await userSpent(userId);
  if (!withinSpendCap(spent, amount, env.MAX_USER_SPEND_USD)) {
    throw new AppError(403, `Demo spending limit reached: ${usd(spent)} of ${usd(env.MAX_USER_SPEND_USD)} used. Ask the demo owner to raise the limit.`);
  }
}
