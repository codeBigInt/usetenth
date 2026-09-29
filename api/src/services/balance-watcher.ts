import { dec } from "../utils/money";

export interface BalanceWatcherDeps {
  /** Current settlement-asset balance (e.g. PYUSD `available`), as a decimal string. */
  fetchBalance: () => Promise<string>;
  /** The balance we last accounted for. Null means this has never run. */
  getWatermark: () => Promise<string | null>;
  setWatermark: (value: string) => Promise<void>;
}

/**
 * True Markets' history and transfer endpoints don't record an external transfer landing on this
 * account's wallet (that tracking needs a verified account, which this demo one isn't) — but
 * `listBalances` does. So a deposit is detected as a rise in the settlement-asset balance since the
 * last poll: buys spend it and sells pay out in a different asset, so in this account nothing but an
 * external deposit makes it go up. The watermark is advanced before returning, so a poller that dies
 * mid-cycle and restarts never double-counts the same rise.
 */
export async function pollBalanceOnce(deps: BalanceWatcherDeps): Promise<{ amount: string } | null> {
  const current = await deps.fetchBalance();
  const prior = await deps.getWatermark();
  if (prior === null) {
    await deps.setWatermark(current); // baseline only: nothing before this point counts as a deposit
    return null;
  }
  await deps.setWatermark(current);
  const delta = dec(current).minus(prior);
  return delta.gt(0) ? { amount: delta.toFixed() } : null;
}
