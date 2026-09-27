import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { env } from "../config/env";
import { TrueMarketsError, trueMarketsService } from "../integrations/truemarkets/truemarkets.service";
import { Asset, Order, Position, User } from "../models";
import { dec } from "../utils/money";
import { cleanName } from "../utils/names";
import { assetKeyFor, listInvestable, toOrderTarget } from "./assets.service";
import AppError from "./error";
import { assertCanSpend, spendRemaining } from "./guards";
import { MIN_NOTIONAL_USD } from "./investment.pure";
import { matchSettlements, normalizeHistory, sellSettlementOf, settlementOf } from "./history.pure";
import { recordFill } from "./ledger.service";
import type { TelegramUser } from "./telegram-auth";
import { amountProblem, pricePerToken, withinSlippage } from "./trade.pure";

export interface TradePreview {
  assetKey: string;
  name: string;
  chain: string;
  amount: string;
  qtyOut: string;
  price: string | null;
  fee: string;
  issues: string[];
  enabled: boolean;
  minUsd: string;
  maxUsd: string;
  /** What this user may still spend under the demo cap; null when caps are off. */
  remainingUsd: string | null;
}

export interface TradeResult {
  orderId: string;
  status: string;
  txHash: string | null;
  executedQty: string | null;
  price: string | null;
  fee: string | null;
}

async function loadDefiAsset(assetKey: string) {
  const doc = await Asset.findOne({ assetKey });
  if (!doc || doc.venue !== "defi" || !doc.chain) throw new AppError(400, "Only tokenized stocks can be bought here.");
  if (!(await listInvestable()).some((a) => a.assetKey === assetKey)) throw new AppError(400, "That stock cannot be bought right now.");
  return doc;
}

const issueMessages = (issues: { message: string }[] | undefined) => (issues ?? []).map((i) => i.message);

export async function previewBuy(assetKey: string, amount: string, tg?: TelegramUser): Promise<TradePreview> {
  const problem = amountProblem(amount, env.TEST_BUY_MAX_USD);
  if (problem) throw new AppError(400, problem);
  const doc = await loadDefiAsset(assetKey);
  const quote = await trueMarketsService.defiQuoteBuy(toOrderTarget(doc), amount).catch((e) => {
    if (e instanceof TrueMarketsError) throw new AppError(e.status >= 500 || e.status === 0 ? 502 : 422, "True Markets could not quote that right now.");
    throw e;
  });
  return {
    assetKey,
    name: cleanName(doc.name ?? doc.symbol),
    chain: doc.chain!,
    amount,
    qtyOut: quote.qty_out ?? "0",
    price: pricePerToken(amount, quote.qty_out ?? "0"),
    fee: quote.fee ?? "0",
    issues: issueMessages(quote.issues),
    enabled: env.TEST_BUY_ENABLED,
    minUsd: MIN_NOTIONAL_USD,
    maxUsd: env.TEST_BUY_MAX_USD,
    remainingUsd: await remainingFor(tg),
  };
}

async function remainingFor(tg?: TelegramUser): Promise<string | null> {
  if (!tg) return null;
  const user = await User.findOne({ telegramId: String(tg.id) }).select("_id");
  return spendRemaining(user ? String(user._id) : "000000000000000000000000");
}

interface PlaceInput {
  userId: string;
  assetKey: string;
  amount: string;
  idempotencyKey: string;
  investmentEventId?: string;
  minQtyOut?: string;
}

/**
 * The one place that spends. The order row exists before anything is signed; a replayed key returns the same order;
 * a definite refusal marks it failed; an unknown outcome (timeout, 5xx) is never retried.
 */
export async function placeDefiBuy(input: PlaceInput): Promise<TradeResult> {
  const existing = await Order.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (existing.status === "complete" || existing.status === "pending") return viewOf(existing);
    throw new AppError(409, existing.status === "failed" ? `That order already failed: ${existing.failureReason ?? "declined"}.` : "That order's outcome is not confirmed yet. It has not been retried; check your history before trying again.");
  }

  const doc = await loadDefiAsset(input.assetKey);
  await assertCanSpend(input.userId, input.amount);

  const order = await Order.create({
    userId: input.userId,
    investmentEventId: input.investmentEventId,
    idempotencyKey: input.idempotencyKey,
    asset: input.assetKey,
    settlementAsset: env.TM_SETTLEMENT_ASSET,
    side: "buy",
    amount: input.amount,
    venue: "defi",
  });
  const fail = async (status: "failed" | "rejected_slippage", reason: string) => {
    order.status = status;
    order.failureReason = reason;
    await order.save();
  };

  let quote;
  try {
    quote = await trueMarketsService.defiQuoteBuy(toOrderTarget(doc), input.amount);
  } catch (e) {
    await fail("failed", "quote unavailable");
    throw new AppError(502, "True Markets could not quote that right now. Nothing was bought.");
  }
  order.quoteId = quote.quote_id;
  order.settlementAsset = quote.quote_asset ?? order.settlementAsset;

  const issues = issueMessages(quote.issues);
  if (issues.length > 0) {
    await fail("failed", issues.join("; "));
    throw new AppError(422, `${issues.join("; ")}. Nothing was bought.`);
  }
  if (!withinSlippage(quote.qty_out ?? "0", input.minQtyOut)) {
    await fail("rejected_slippage", "price moved");
    throw new AppError(409, "The price moved since your quote. Nothing was bought; get a new quote.");
  }
  await order.save();

  let signatures: string[];
  try {
    signatures = await trueMarketsService.defiSign(quote.payloads ?? []);
  } catch {
    await fail("failed", "signing failed");
    throw new AppError(500, "We could not sign the trade. Nothing was bought.");
  }

  let trade;
  try {
    trade = await trueMarketsService.defiSubmit(quote.quote_id!, signatures);
  } catch (e) {
    if (e instanceof TrueMarketsError && e.status >= 400 && e.status < 500) {
      await fail("failed", e.message);
      throw new AppError(422, "True Markets declined the trade. Nothing was bought.");
    }
    await order.save();
    throw new AppError(502, "We could not confirm the trade with True Markets. It has not been retried; check your history before trying again.");
  }

  const executed = dec(trade.executed_qty ?? "0");
  order.providerOrderId = trade.order_id;
  order.txHash = trade.tx_hash;
  order.status = executed.gt(0) ? "complete" : "pending";
  await order.save();

  if (executed.gt(0)) {
    const vwap = dec(trade.executed_vwap ?? "0");
    await recordFill({
      userId: input.userId,
      orderId: String(order._id),
      assetKey: input.assetKey,
      side: "buy",
      quantity: trade.executed_qty!,
      price: vwap.gt(0) ? vwap.toFixed() : (pricePerToken(input.amount, trade.executed_qty!) ?? "0"),
      fee: trade.fee ?? "0",
      settlementAsset: order.settlementAsset,
    });
  }
  return viewOf(order, trade);
}

function viewOf(order: InstanceType<typeof Order>, trade?: { executed_qty?: string; executed_vwap?: string; fee?: string }): TradeResult {
  return {
    orderId: String(order._id),
    status: order.status,
    txHash: order.txHash ?? null,
    executedQty: trade?.executed_qty ?? null,
    price: trade?.executed_vwap && dec(trade.executed_vwap).gt(0) ? trade.executed_vwap : null,
    fee: trade?.fee ?? null,
  };
}

/** A manual buy from the UI: off unless TEST_BUY_ENABLED, capped, and only for someone with demo access. */
export async function testBuy(tg: TelegramUser, i: { assetKey: string; amount: string; minQtyOut?: string; idempotencyKey?: string }): Promise<TradeResult> {
  if (!env.TEST_BUY_ENABLED) throw new AppError(403, "Live test buys are switched off. Set TEST_BUY_ENABLED=true to allow them.");
  const problem = amountProblem(i.amount, env.TEST_BUY_MAX_USD);
  if (problem) throw new AppError(400, problem);
  const telegramId = String(tg.id);
  const user = await User.findOneAndUpdate({ telegramId }, { telegramId, telegramUsername: tg.username }, { upsert: true, new: true });
  return placeDefiBuy({ userId: String(user._id), assetKey: i.assetKey, amount: i.amount, minQtyOut: i.minQtyOut, idempotencyKey: i.idempotencyKey ?? `manual:${telegramId}:${randomUUID()}` });
}

/**
 * DeFi trades settle on True Markets' side, so the submit response often has no executed quantity. The account history
 * does: pair each pending buy with the SUCCESS row that settled it, record the real fill (which books the cost basis
 * and position), and mark a FAILED one failed. Safe to run repeatedly.
 */
export async function reconcileDefiOrders(): Promise<number> {
  const pending = await Order.find({ venue: "defi", status: "pending" });
  if (pending.length === 0) return 0;
  const { data, error } = await trueMarketsService.listHistory(50);
  if (error || !data) return 0;
  const rows = ((data.items ?? []) as unknown[]).map(normalizeHistory);
  const claimed = new Set((await Order.find({ historyId: { $exists: true } }).select("historyId")).map((o) => o.historyId!).filter(Boolean));

  const matches = matchSettlements(
    pending.map((o) => ({ id: String(o._id), side: o.side, address: o.asset.split(":")[1] ?? "", createdAt: (o as unknown as { createdAt: Date }).createdAt, amount: o.amount, historyId: o.historyId })),
    rows,
    claimed,
  );

  let settled = 0;
  for (const { orderId, row } of matches) {
    const order = pending.find((o) => String(o._id) === orderId)!;
    order.historyId = row.id;
    order.txHash = row.txHash ?? order.txHash;
    if (row.status === "FAILED") {
      order.status = "failed";
      order.failureReason = "True Markets reported the trade failed";
      await order.save();
      continue;
    }
    await order.save(); // claim the row first, so a crash below cannot pair it with another order
    if (order.side === "sell") {
      const sold = sellSettlementOf(order, row);
      await recordFill({ userId: String(order.userId), orderId, assetKey: order.asset, side: "sell", quantity: sold.quantity, price: sold.price, fee: "0", notional: sold.proceeds, settlementAsset: order.settlementAsset });
      settled++;
      continue;
    }
    const { quantity, price } = settlementOf(order, row);
    await recordFill({
      userId: String(order.userId),
      orderId,
      assetKey: order.asset,
      side: "buy",
      quantity,
      price,
      fee: "0", // the quote's fee is inside the amount spent, so the price paid already includes it
      notional: order.amount,
      settlementAsset: order.settlementAsset,
    });
    settled++;
  }
  return settled;
}


// ---------------------------------------------------------------------------------------------------------------
// Selling. A user may only sell what they bought themselves (their own ledger position), never the whole shared
// account's holding, and never more than the wallet actually has.
// ---------------------------------------------------------------------------------------------------------------

export interface SellPreview {
  assetKey: string;
  name: string;
  chain: string;
  qty: string;
  receive: string;
  price: string | null;
  fee: string;
  receiveAsset: string | null;
  issues: string[];
  enabled: boolean;
}

async function loadHeldDefiAsset(assetKey: string) {
  const doc = await Asset.findOne({ assetKey });
  if (!doc || doc.venue !== "defi" || !doc.chain || !doc.address) throw new AppError(400, "That is not a stock this account can sell.");
  return doc;
}

/** The tokens this user may sell: what their own buys left them, capped by what the wallet holds. */
export async function sellableQty(userId: string, assetKey: string, address: string): Promise<string> {
  const position = await Position.findOne({ userId, assetKey });
  const { data } = await trueMarketsService.listBalances();
  const held = (data?.data ?? []).find((b) => b.address?.toLowerCase() === address.toLowerCase());
  const qty = Decimal.min(dec(position?.quantity ?? "0"), dec(held?.available ?? "0"));
  return qty.gt(0) ? qty.toFixed() : "0";
}

async function receiveSymbol(chain: string, quoteAsset?: string): Promise<string | null> {
  if (!quoteAsset) return null;
  const doc = await Asset.findOne({ assetKey: assetKeyFor({ chain, address: quoteAsset }) }).select("symbol");
  return doc?.symbol ?? null;
}

async function userIdFor(tg: TelegramUser): Promise<string | null> {
  const user = await User.findOne({ telegramId: String(tg.id) }).select("_id");
  return user ? String(user._id) : null;
}

export async function previewSell(assetKey: string, tg: TelegramUser): Promise<SellPreview> {
  const userId = await userIdFor(tg);
  const doc = await loadHeldDefiAsset(assetKey);
  const qty = userId ? await sellableQty(userId, assetKey, doc.address!) : "0";
  if (qty === "0") throw new AppError(400, "You do not have any of this stock to sell. You can only sell what you bought yourself.");
  const quote = await trueMarketsService.defiQuoteSell(toOrderTarget(doc), qty).catch((e) => {
    if (e instanceof TrueMarketsError) throw new AppError(e.status >= 500 || e.status === 0 ? 502 : 422, "True Markets could not quote that right now.");
    throw e;
  });
  return {
    assetKey,
    name: cleanName(doc.name ?? doc.symbol),
    chain: doc.chain!,
    qty,
    receive: quote.qty_out ?? "0",
    price: pricePerToken(quote.qty_out ?? "0", qty),
    fee: quote.fee ?? "0",
    receiveAsset: await receiveSymbol(doc.chain!, quote.quote_asset),
    issues: issueMessages(quote.issues),
    enabled: env.TEST_BUY_ENABLED,
  };
}

interface SellInput {
  userId: string;
  assetKey: string;
  idempotencyKey: string;
  minReceive?: string;
}

/** Same guarantees as placeDefiBuy: row first, replay-safe, definite failures marked, unknown outcomes never retried. */
export async function placeDefiSell(input: SellInput): Promise<TradeResult> {
  const existing = await Order.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (existing.status === "complete" || existing.status === "pending") return viewOf(existing);
    throw new AppError(409, existing.status === "failed" ? `That order already failed: ${existing.failureReason ?? "declined"}.` : "That order's outcome is not confirmed yet. It has not been retried; check your history before trying again.");
  }
  const doc = await loadHeldDefiAsset(input.assetKey);
  const qty = await sellableQty(input.userId, input.assetKey, doc.address!);
  if (qty === "0") throw new AppError(400, "You do not have any of this stock to sell.");

  const order = await Order.create({
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
    asset: input.assetKey,
    settlementAsset: env.TM_SETTLEMENT_ASSET,
    side: "sell",
    amount: qty,
    amountUnit: "base",
    venue: "defi",
  });
  const fail = async (status: "failed" | "rejected_slippage", reason: string) => {
    order.status = status;
    order.failureReason = reason;
    await order.save();
  };

  let quote;
  try {
    quote = await trueMarketsService.defiQuoteSell(toOrderTarget(doc), qty);
  } catch {
    await fail("failed", "quote unavailable");
    throw new AppError(502, "True Markets could not quote that right now. Nothing was sold.");
  }
  order.quoteId = quote.quote_id;
  order.quotedOut = quote.qty_out;
  order.settlementAsset = quote.quote_asset ?? order.settlementAsset;

  const issues = issueMessages(quote.issues);
  if (issues.length > 0) {
    await fail("failed", issues.join("; "));
    throw new AppError(422, `${issues.join("; ")}. Nothing was sold.`);
  }
  if (!withinSlippage(quote.qty_out ?? "0", input.minReceive)) {
    await fail("rejected_slippage", "price moved");
    throw new AppError(409, "The price moved since your quote. Nothing was sold; get a new quote.");
  }
  await order.save();

  let signatures: string[];
  try {
    signatures = await trueMarketsService.defiSign(quote.payloads ?? []);
  } catch {
    await fail("failed", "signing failed");
    throw new AppError(500, "We could not sign the trade. Nothing was sold.");
  }

  let trade;
  try {
    trade = await trueMarketsService.defiSubmit(quote.quote_id!, signatures);
  } catch (e) {
    if (e instanceof TrueMarketsError && e.status >= 400 && e.status < 500) {
      await fail("failed", e.message);
      throw new AppError(422, "True Markets declined the trade. Nothing was sold.");
    }
    await order.save();
    throw new AppError(502, "We could not confirm the trade with True Markets. It has not been retried; check your history before trying again.");
  }

  const executed = dec(trade.executed_qty ?? "0");
  order.providerOrderId = trade.order_id;
  order.txHash = trade.tx_hash;
  order.status = executed.gt(0) ? "complete" : "pending";
  await order.save();

  if (executed.gt(0)) {
    const vwap = dec(trade.executed_vwap ?? "0");
    const proceeds = vwap.gt(0) ? executed.mul(vwap).toFixed() : (quote.qty_out ?? "0");
    await recordFill({
      userId: input.userId,
      orderId: String(order._id),
      assetKey: input.assetKey,
      side: "sell",
      quantity: trade.executed_qty!,
      price: pricePerToken(proceeds, trade.executed_qty!) ?? "0",
      fee: "0",
      notional: proceeds,
      settlementAsset: order.settlementAsset,
    });
  }
  return viewOf(order, trade);
}

export async function testSell(tg: TelegramUser, i: { assetKey: string; minReceive?: string; idempotencyKey?: string }): Promise<TradeResult> {
  if (!env.TEST_BUY_ENABLED) throw new AppError(403, "Live test trades are switched off. Set TEST_BUY_ENABLED=true to allow them.");
  const userId = await userIdFor(tg);
  if (!userId) throw new AppError(400, "You do not have any of this stock to sell.");
  return placeDefiSell({ userId, assetKey: i.assetKey, minReceive: i.minReceive, idempotencyKey: i.idempotencyKey ?? `manual-sell:${tg.id}:${randomUUID()}` });
}
