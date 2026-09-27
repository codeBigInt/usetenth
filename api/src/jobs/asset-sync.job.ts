import { assetKeyFor, canonicalTicker } from "../services/assets.service";
import { trueMarketsService } from "../integrations/truemarkets/truemarkets.service";
import { Asset } from "../models";
import type { RawAssetItem } from "../utils/types";

export async function syncAssets(): Promise<number> {
  const { data, error } = await trueMarketsService.listAssets();
  if (error || !data) {
    console.error("Asset sync failed", { error });
    return 0;
  }

  const items = (data.data ?? []) as RawAssetItem[];
  let synced = 0;
  for (const item of items) {
    if (!item.symbol || !item.venue || !item.asset_class) continue;
    await Asset.findOneAndUpdate(
      { assetKey: assetKeyFor(item) },
      {
        assetKey: assetKeyFor(item),
        symbol: item.symbol,
        ticker: canonicalTicker({ chain: item.chain, symbol: item.symbol, assetClass: item.asset_class }),
        name: item.name,
        chain: item.chain ?? undefined,
        address: item.address ?? undefined,
        venue: item.venue,
        assetClass: item.asset_class,
        tradeable: !!item.tradeable,
        stable: !!item.stable,
        providerId: item.id,
        networks: (item.networks ?? []).map((n) => ({ network: n.network, compatible: n.compatible_networks })),
        syncedAt: new Date(),
      },
      { upsert: true },
    );
    synced++;
  }
  return synced;
}

export class AssetSyncJob {
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;

  constructor(private readonly intervalMs = 60 * 60 * 1000) {}

  start() {
    this.run();
    this.timer = setInterval(() => this.run(), this.intervalMs);
  }

  private run() {
    if (this.inFlight) return;
    this.inFlight = syncAssets()
      .then((n) => console.info(`Asset sync: ${n} assets`))
      .catch((e) => console.error("Asset sync failed", e))
      .finally(() => (this.inFlight = undefined));
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }
}
