import Decimal from "decimal.js";
import { dec } from "../utils/money";
import { assetKeyFor } from "./assets.service";

export interface BalanceRow {
  symbol?: string;
  name?: string;
  venue?: string;
  chain?: string | null;
  address?: string | null;
  total?: string;
  available?: string;
  stable?: boolean;
}

export interface Holding {
  assetKey: string;
  symbol: string;
  name: string;
  quantity: string;
  cost: string | null;
  price: string | null;
  value: string | null;
  /** How much of this the asking user bought themselves, and so may sell. Null when we do not know who is asking. */
  owned: string | null;
}

export interface Portfolio {
  asset: string;
  cash: string;
  holdings: Holding[];
  invested: string;
  value: string;
  gain: string | null;
}

const cents = (d: Decimal) => d.toFixed(2, Decimal.ROUND_DOWN);

export function buildPortfolio(
  balances: BalanceRow[],
  costs: Record<string, string>,
  prices: Record<string, string | null>,
  settlementAsset: string,
  owned: Record<string, string> | null = null,
): Portfolio {
  const cash = balances.filter((b) => b.stable).reduce((a, b) => a.plus(b.available ?? "0"), dec(0));

  const holdings: Holding[] = balances
    .filter((b) => !b.stable && dec(b.total ?? "0").gt(0))
    .map((b) => {
      const assetKey = assetKeyFor({ chain: b.chain, address: b.address, symbol: b.symbol });
      const price = prices[assetKey] ?? null;
      return {
        assetKey,
        symbol: b.symbol ?? "",
        name: b.name ?? b.symbol ?? "",
        quantity: b.total ?? "0",
        cost: costs[assetKey] ?? null,
        price,
        value: price ? cents(dec(b.total ?? "0").mul(price)) : null,
        owned: owned ? (owned[assetKey] ?? "0") : null,
      };
    });

  const invested = holdings.reduce((a, h) => a.plus(h.cost ?? "0"), dec(0));
  const value = holdings.reduce((a, h) => a.plus(h.value ?? h.cost ?? "0"), dec(0));
  const priced = holdings.length > 0 && holdings.every((h) => h.value !== null && h.cost !== null);

  return {
    asset: settlementAsset,
    cash: cents(cash),
    holdings,
    invested: cents(invested),
    value: cents(value),
    gain: priced ? cents(value.minus(invested)) : null,
  };
}
