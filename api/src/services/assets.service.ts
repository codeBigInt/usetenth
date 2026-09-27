import Decimal from "decimal.js";
import type { Basket } from "../config/baskets";
import { isStockTickerEligible, whitelistByKey } from "../config/whitelist";
import type { OrderTarget } from "../integrations/truemarkets/truemarkets.service";
import { Asset } from "../models/asset";
import { dec } from "../utils/money";

export interface InvestableAsset {
  assetKey: string;
  symbol: string;
  ticker: string;
  displayName: string;
  kind: string;
  venue: string;
}

export interface Allocation {
  assetKey: string;
  amount: string;
}

export function assetKeyFor(a: { chain?: string | null; address?: string | null; symbol?: string }): string {
  if (a.chain && a.address) return `${a.chain}:${a.address.toLowerCase()}`;
  return `cefi:${(a.symbol ?? "").toUpperCase()}`;
}

// Coinbase-tokenized stocks on base append "C" to the ticker (AAPL -> AAPLC).
export function canonicalTicker(a: { chain?: string | null; symbol?: string; assetClass?: string }): string {
  const symbol = (a.symbol ?? "").toUpperCase();
  if (a.assetClass === "stock" && a.chain === "base" && symbol.endsWith("C")) return symbol.slice(0, -1);
  return symbol;
}

export async function listInvestable(): Promise<InvestableAsset[]> {
  const enabledCryptoKeys = [...whitelistByKey.values()].filter((w) => w.enabled).map((w) => w.assetKey);

  const [cryptoCatalog, stockCatalog] = await Promise.all([
    Asset.find({ assetKey: { $in: enabledCryptoKeys }, tradeable: true }).select("assetKey"),
    Asset.find({ assetClass: "stock", tradeable: true }).select("assetKey symbol ticker name"),
  ]);

  const availableCryptoKeys = new Set(cryptoCatalog.map((c) => c.assetKey));
  const crypto = [...whitelistByKey.values()]
    .filter((w) => w.enabled && availableCryptoKeys.has(w.assetKey))
    .map((w) => ({ assetKey: w.assetKey, symbol: w.symbol, ticker: w.symbol, displayName: w.displayName, kind: w.kind, venue: w.venue }));

  const stocks = stockCatalog
    .filter((s) => isStockTickerEligible(s.ticker))
    .map((s) => ({ assetKey: s.assetKey, symbol: s.symbol, ticker: s.ticker, displayName: s.name ?? s.symbol, kind: "equity", venue: "defi" }));

  return [...crypto, ...stocks];
}

export function toOrderTarget(a: { venue?: string | null; symbol?: string | null; chain?: string | null; address?: string | null }): OrderTarget {
  if (a.venue === "cefi" || !a.address) return { baseAsset: a.symbol ?? "" };
  return { baseAsset: a.address, chain: a.chain ?? undefined };
}

// assetKey lowercases addresses, which corrupts case-sensitive ones (Solana): read the original from the catalog.
export async function resolveOrderTarget(assetKey: string): Promise<OrderTarget> {
  const doc = await Asset.findOne({ assetKey });
  if (!doc) throw new Error(`asset not in catalog: ${assetKey}`);
  return toOrderTarget(doc);
}

interface WeightedKey {
  assetKey: string;
  weight: Decimal;
}

function splitByWeights(amount: string, weights: WeightedKey[]): Allocation[] {
  const totalCents = dec(amount).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const rows = weights.map((w) => {
    const rawCents = totalCents.mul(w.weight);
    const cents = rawCents.toDecimalPlaces(0, Decimal.ROUND_DOWN);
    return { assetKey: w.assetKey, cents, remainder: rawCents.minus(cents) };
  });

  const distributed = rows.reduce((a, r) => a.plus(r.cents), dec(0));
  const leftover = totalCents.minus(distributed).toNumber();

  const byRemainder = [...rows].sort((a, b) => b.remainder.cmp(a.remainder));
  for (let i = 0; i < leftover; i++) {
    const row = byRemainder[i]!;
    row.cents = row.cents.plus(1);
  }

  return rows.map((r) => ({ assetKey: r.assetKey, amount: r.cents.div(100).toFixed(2) }));
}

export function split(amount: string, basket: Basket): Allocation[] {
  return splitByWeights(amount, basket.weights.map((w) => ({ assetKey: w.assetKey, weight: dec(w.weight) })));
}

export function rebalancedSplit(amount: string, basket: Basket, positionValues: Record<string, string>): Allocation[] {
  const currentTotal = basket.weights.reduce((a, w) => a.plus(positionValues[w.assetKey] ?? "0"), dec(0));
  const newTotal = currentTotal.plus(amount);

  const idealContributions = basket.weights.map((w) => {
    const target = dec(w.weight).mul(newTotal);
    const current = dec(positionValues[w.assetKey] ?? "0");
    return { assetKey: w.assetKey, ideal: Decimal.max(target.minus(current), 0) };
  });
  const idealSum = idealContributions.reduce((a, c) => a.plus(c.ideal), dec(0));

  if (idealSum.isZero()) return split(amount, basket);

  return splitByWeights(
    amount,
    idealContributions.map((c) => ({ assetKey: c.assetKey, weight: c.ideal.div(idealSum) })),
  );
}
