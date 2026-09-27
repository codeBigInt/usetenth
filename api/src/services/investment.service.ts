import { env } from "../config/env";
import { trueMarketsService } from "../integrations/truemarkets/truemarkets.service";
import { InvestmentEvent, Order, OrderEvent, Payment, Rule } from "../models";
import { dec, percentOf } from "../utils/money";
import { resolveOrderTarget } from "./assets.service";
import { assertCanSpend } from "./guards";
import { placeDefiBuy } from "./trade.service";
import { MIN_NOTIONAL_USD, planOrders } from "./investment.pure";

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

export async function processPayment(paymentId: string) {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.status !== "confirmed") return null;

  const rule = await Rule.findOne({ userId: payment.userId, enabled: true, type: "PAYMENT_PERCENTAGE" });
  if (!rule?.percentage || rule.allocations.length === 0) return null;

  const investmentAmount = percentOf(payment.amount, rule.percentage);
  if (rule.minimumAmount && dec(investmentAmount).lt(rule.minimumAmount)) return null;

  const { orders, skipped } = planOrders(investmentAmount, rule.allocations);
  if (orders.length === 0) {
    console.info(`Payment ${paymentId}: ${investmentAmount} is too small to split across ${skipped.length} assets (minimum order ${MIN_NOTIONAL_USD}); nothing invested`);
    return null;
  }
  if (skipped.length > 0) console.info(`Payment ${paymentId}: skipped ${skipped.length} legs under the minimum order of ${MIN_NOTIONAL_USD}`);

  let event;
  try {
    event = await InvestmentEvent.create({
      userId: payment.userId,
      paymentId: payment._id,
      ruleId: rule._id,
      sourceAmount: payment.amount,
      investmentAmount,
      status: "processing",
    });
  } catch (e) {
    if (isDuplicateKey(e)) return null; // already invested this payment
    throw e;
  }

  let failed = false;
  for (const { asset, amount } of orders) {
    if (dec(amount).gt(env.MAX_ORDER_USD)) {
      failed = true;
      continue; // safety cap: never send an oversized order in prod
    }
    try {
      await placeOrder(event._id.toString(), payment.userId.toString(), asset, amount);
    } catch (err) {
      failed = true;
      console.error(`order for ${asset} failed`, err);
    }
  }

  event.status = failed ? "failed" : "completed";
  await event.save();
  payment.status = "processed";
  await payment.save();
  return event;
}

async function placeOrder(eventId: string, userId: string, asset: string, amount: string) {
  const target = await resolveOrderTarget(asset);
  // Tokenized stocks and other DeFi assets trade through the DeFi API: quoted, signed with the API key, then submitted.
  if (target.chain && !env.DRY_RUN) {
    await placeDefiBuy({ userId, assetKey: asset, amount, idempotencyKey: `${eventId}:${asset}`, investmentEventId: eventId });
    return;
  }
  if (!target.chain && !env.DRY_RUN) await assertCanSpend(userId, amount);
  const order = await Order.create({
    userId,
    investmentEventId: eventId,
    idempotencyKey: `${eventId}:${asset}`,
    settlementAsset: env.TM_SETTLEMENT_ASSET,
    asset,
    side: "buy",
    amount,
  });
  const log = (status: string, payload?: unknown) =>
    OrderEvent.create({ orderId: order._id, status, payload });

  if (env.DRY_RUN) {
    const quote = target.chain
      ? await trueMarketsService.defiQuoteBuy(target, amount).then(({ qty_out, fee, issues }) => ({ qty_out, fee, issues }))
      : await trueMarketsService.quote(target, amount);
    await log("dry_run_quote", quote);
    return order;
  }

  const res = await trueMarketsService.createBuyOrder(target, amount);
  await log(res.kind, res);
  if (res.kind === "rejected") {
    order.status = "failed";
  } else {
    order.providerOrderId = res.orderId;
    // TODO: signing for needs_signing orders (execute) once the signing helper is confirmed
    order.status = res.kind === "needs_signing" ? "initialized" : (res.status ?? "pending");
  }
  await order.save();
  return order;
}
