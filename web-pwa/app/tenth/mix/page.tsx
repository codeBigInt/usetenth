"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Screen } from "@/components/ui";
import { fetchInvestable, type InvestableAsset } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { cleanName, MIXES, summarize, type MixStock } from "@/lib/mixes";
import { useStore } from "@/lib/store";

const issuer = (a: InvestableAsset) =>
  a.assetKey.startsWith("robinhood:") ? "Robinhood" : a.assetKey.startsWith("base:") ? "Coinbase" : a.kind === "crypto" ? "Crypto" : "";

export default function MixPage() {
  const { settings, mix, update } = useStore();
  const [assets, setAssets] = useState<InvestableAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchInvestable(controller.signal)
      .then(setAssets)
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      });
    return () => controller.abort();
  }, []);

  const picked = useMemo(() => new Set(settings.customStocks.map((s) => s.assetKey)), [settings.customStocks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (assets ?? [])
      .filter((a) => !q || a.symbol.toLowerCase().includes(q) || a.displayName.toLowerCase().includes(q))
      .sort((a, b) => Number(b.kind === "equity") - Number(a.kind === "equity") || a.displayName.localeCompare(b.displayName));
  }, [assets, query]);

  const toggle = (a: InvestableAsset) => {
    const on = picked.has(a.assetKey);
    const next: MixStock[] = on
      ? settings.customStocks.filter((s) => s.assetKey !== a.assetKey)
      : [...settings.customStocks, { assetKey: a.assetKey, ticker: a.symbol, name: cleanName(a.displayName) }];
    update({ customStocks: next, mixId: next.length > 0 ? "custom" : "steady" });
  };

  return (
    <Screen back="/tenth" title="Your mix" subtitle={`${mix.name}: ${summarize(mix.stocks)}`}>
      <div className="flex flex-col gap-3">
        {MIXES.map((m) => {
          const on = settings.mixId === m.id;
          return (
            <button
              key={m.id}
              onClick={() => update({ mixId: m.id })}
              aria-pressed={on}
              className={`rounded-2xl border p-4 text-left transition ${on ? "border-violet bg-violet/10" : "border-line bg-card/90"}`}
            >
              <span className="block font-medium">{m.name}</span>
              <span className="block text-sm text-mute">{m.blurb}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2">
        <h2 className="px-1 text-[15px] font-medium">Or pick your own</h2>
        <p className="mb-3 px-1 text-sm text-mute">Every stock here is in the S&amp;P 500 and can be bought right now.</p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or ticker"
          className="mb-3 h-12 w-full rounded-2xl border border-line bg-card px-4 outline-none"
        />

        {error ? (
          <Card>
            <p className="font-medium">Couldn&apos;t load the stock list.</p>
            <p className="mt-1 text-sm text-mute">Is the API running at {API_URL}? {error}</p>
          </Card>
        ) : assets === null ? (
          <p className="px-1 text-sm text-mute">Loading available stocks…</p>
        ) : visible.length === 0 ? (
          <p className="px-1 text-sm text-mute">No stocks match &ldquo;{query}&rdquo;.</p>
        ) : (
          <Card className="divide-y divide-line p-0">
            {visible.map((a) => {
              const on = picked.has(a.assetKey);
              return (
                <button
                  key={a.assetKey}
                  onClick={() => toggle(a)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-violet bg-violet text-white" : "border-mute/60"}`}>
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{cleanName(a.displayName)}</span>
                    <span className="num block text-xs text-mute">{a.symbol}{issuer(a) ? ` · ${issuer(a)}` : ""}</span>
                  </span>
                </button>
              );
            })}
          </Card>
        )}
      </div>
    </Screen>
  );
}
