import { pricePerToken } from "./trade.pure";

/** One row of True Markets account history. The live API returns camelCase; the SDK's types say snake_case. */
export interface HistoryRow {
  id: string;
  submittedAt: Date | null;
  status: string;
  txHash: string | null;
  amount: string;
  toAsset: string;
  fromAsset: string;
  action: string;
}

const pick = (e: Record<string, unknown>, camel: string, snake: string) => (e[camel] ?? e[snake]) as string | undefined;

export function normalizeHistory(raw: unknown): HistoryRow {
  const e = (raw ?? {}) as Record<string, unknown>;
  const submitted = pick(e, "submittedDate", "submitted_date");
  return {
    id: String(e.id ?? ""),
    submittedAt: submitted ? new Date(submitted) : null,
    status: String(e.status ?? ""),
    txHash: pick(e, "txHash", "tx_hash") || null,
    amount: String(e.amount ?? ""),
    toAsset: pick(e, "toAsset", "to_asset") ?? "",
    fromAsset: pick(e, "fromAsset", "from_asset") ?? "",
    action: String(e.action ?? ""),
  };
}

export interface PendingDefiOrder {
  id: string;
  side?: "buy" | "sell";
  /** the token's contract address (the part of the asset key after the chain) */
  address: string;
  createdAt: Date;
  amount: string;
  historyId?: string | null;
}

const SETTLED = new Set(["SUCCESS", "FAILED"]);
const BEFORE_MS = 2 * 60 * 1000;
const AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * Pairs pending buys with the history rows that settled them: a BUY of the same token, submitted shortly after the
 * order was placed, not already claimed by another order. Same-token orders pair in order, earliest to earliest.
 */
export function matchSettlements(orders: PendingDefiOrder[], rows: HistoryRow[], claimed: ReadonlySet<string> = new Set()) {
  const taken = new Set(claimed);
  const out: { orderId: string; row: HistoryRow }[] = [];
  for (const o of [...orders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (o.historyId) {
      const row = rows.find((r) => r.id === o.historyId);
      if (row && SETTLED.has(row.status)) out.push({ orderId: o.id, row });
      continue;
    }
    const row = rows
      .filter(
        (r) =>
          r.action === (o.side === "sell" ? "SELL" : "BUY") &&
          SETTLED.has(r.status) &&
          !taken.has(r.id) &&
          (o.side === "sell" ? r.fromAsset : r.toAsset).toLowerCase() === o.address.toLowerCase() &&
          r.submittedAt !== null &&
          r.submittedAt.getTime() >= o.createdAt.getTime() - BEFORE_MS &&
          r.submittedAt.getTime() <= o.createdAt.getTime() + AFTER_MS,
      )
      .sort((a, b) => a.submittedAt!.getTime() - b.submittedAt!.getTime())[0];
    if (row) {
      taken.add(row.id);
      out.push({ orderId: o.id, row });
    }
  }
  return out;
}

/** What settling a matched order records: the tokens actually received and the dollar price paid for them. */
export const settlementOf = (order: { amount: string }, row: HistoryRow) => ({
  quantity: row.amount,
  price: pricePerToken(order.amount, row.amount) ?? "0",
});

const close = (a: string, b: string) => {
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= Math.max(x, y) * 0.02;
};

/**
 * What a settled sell recorded: the tokens sold, and the dollars received. The history row's `amount` is either the
 * tokens sold or the dollars received; whichever it is, tell them apart by which figure it is close to.
 */
export function sellSettlementOf(order: { amount: string; quotedOut?: string | null }, row: HistoryRow) {
  const proceeds = close(row.amount, order.amount) || !order.quotedOut ? (order.quotedOut ?? row.amount) : row.amount;
  return { quantity: order.amount, proceeds, price: pricePerToken(proceeds, order.amount) ?? "0" };
}
