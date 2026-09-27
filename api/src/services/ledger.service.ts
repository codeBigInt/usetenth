import { Fill, Order, Position } from "../models";
import { dec } from "../utils/money";

export interface FillInput {
  userId: string;
  orderId: string;
  assetKey: string;
  side: "buy" | "sell";
  quantity: string;
  price: string;
  fee?: string;
  /** Dollars actually paid or received, when known. Beats quantity x price, which carries rounding from the price. */
  notional?: string | null;
  settlementAsset: string;
}

/** Applies a fill to a position: weighted-average cost via quantity + costTotal. */
export function applyFill(
  pos: { quantity: string; costTotal: string; realizedGain: string },
  f: Pick<FillInput, "side" | "quantity" | "price" | "fee" | "notional">,
) {
  const qty = dec(pos.quantity);
  const cost = dec(pos.costTotal);
  const fq = dec(f.quantity);
  const notional = f.notional ? dec(f.notional) : fq.mul(f.price);
  if (f.side === "buy") {
    return {
      quantity: qty.plus(fq).toFixed(),
      costTotal: cost.plus(notional).plus(f.fee ?? 0).toFixed(),
      realizedGain: pos.realizedGain,
    };
  }
  if (fq.gt(qty)) throw new Error("sell exceeds position");
  const costRemoved = qty.isZero() ? dec(0) : cost.mul(fq).div(qty); // proportional reduction
  return {
    quantity: qty.minus(fq).toFixed(),
    costTotal: cost.minus(costRemoved).toFixed(),
    realizedGain: dec(pos.realizedGain).plus(notional.minus(f.fee ?? 0).minus(costRemoved)).toFixed(),
  };
}

/** Fill row first (unique on orderId => replays are no-ops), then the position cache. */
export async function recordFill(input: FillInput) {
  try {
    await Fill.create(input);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return; // already recorded
    throw e;
  }
  const pos =
    (await Position.findOne({ userId: input.userId, assetKey: input.assetKey })) ??
    new Position({ userId: input.userId, assetKey: input.assetKey });
  Object.assign(pos, applyFill(pos, input));
  await pos.save();
  await Order.updateOne({ _id: input.orderId }, { status: "complete" });
}

/** Rebuilds positions purely from fills; used by reconcile and tests. */
export async function rebuildPositions(userId: string) {
  const fills = await Fill.find({ userId }).sort({ filledAt: 1, _id: 1 });
  const byAsset = new Map<string, { quantity: string; costTotal: string; realizedGain: string }>();
  for (const f of fills) {
    const cur = byAsset.get(f.assetKey) ?? { quantity: "0", costTotal: "0", realizedGain: "0" };
    byAsset.set(f.assetKey, applyFill(cur, f));
  }
  return byAsset;
}
