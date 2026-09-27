import type { InvestableAsset } from "./assets.service";

export interface Pick {
  assetKey?: string;
  ticker?: string;
}

export interface ResolvedPicks {
  resolved: InvestableAsset[];
  skipped: string[];
}

// The same company can be listed by more than one issuer; prefer Coinbase's (base chain), then the lowest key.
const preferred = (a: InvestableAsset, b: InvestableAsset) =>
  Number(b.assetKey.startsWith("base:")) - Number(a.assetKey.startsWith("base:")) || a.assetKey.localeCompare(b.assetKey);

/** Maps what the user picked (a specific asset, or just a ticker) onto assets that can be bought right now. */
export function resolvePicks(picks: Pick[], investable: InvestableAsset[]): ResolvedPicks {
  const byKey = new Map(investable.map((a) => [a.assetKey, a]));
  const resolved = new Map<string, InvestableAsset>();
  const skipped: string[] = [];

  for (const pick of picks) {
    const direct = pick.assetKey ? byKey.get(pick.assetKey) : undefined;
    const ticker = pick.ticker?.toUpperCase();
    const match = direct ?? (ticker ? investable.filter((a) => a.ticker.toUpperCase() === ticker).sort(preferred)[0] : undefined);
    if (match) resolved.set(match.assetKey, match);
    else skipped.push(pick.ticker ?? pick.assetKey ?? "unknown");
  }
  return { resolved: [...resolved.values()], skipped };
}

/** Equal weights that always sum to exactly 100.00, extra cents going to the first assets. */
export function equalPercentages(count: number): string[] {
  if (count <= 0) return [];
  const total = 10000;
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => {
    const units = base + (i < extra ? 1 : 0);
    return `${Math.floor(units / 100)}.${String(units % 100).padStart(2, "0")}`;
  });
}
