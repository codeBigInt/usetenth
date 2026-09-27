import { env } from "../config/env";
import { trueMarketsService } from "../integrations/truemarkets/truemarkets.service";
import { Position } from "../models";
import { dec } from "../utils/money";
import { assetKeyFor, toOrderTarget } from "./assets.service";
import { buildPortfolio, type BalanceRow, type Portfolio } from "./portfolio.pure";

export type { Portfolio };

/** The demo runs on one True Markets account, so this is that account's live balances. */
export async function getPortfolio(userId?: string): Promise<Portfolio> {
  const { data, error } = await trueMarketsService.listBalances();
  if (error) throw new Error("could not load balances");
  const balances = (data?.data ?? []) as BalanceRow[];

  const positions = await Position.find();
  const costs: Record<string, string> = {};
  for (const p of positions) costs[p.assetKey] = dec(costs[p.assetKey] ?? "0").plus(p.costTotal).toFixed();

  const prices: Record<string, string | null> = {};
  await Promise.all(
    balances
      .filter((b) => !b.stable && dec(b.total ?? "0").gt(0))
      .map(async (b) => {
        prices[assetKeyFor({ chain: b.chain, address: b.address, symbol: b.symbol })] = await trueMarketsService.priceOf(toOrderTarget(b));
      }),
  );

  let owned: Record<string, string> | null = null;
  if (userId) {
    owned = {};
    for (const p of await Position.find({ userId })) owned[p.assetKey] = p.quantity;
  }
  return buildPortfolio(balances, costs, prices, env.TM_SETTLEMENT_ASSET, owned);
}
