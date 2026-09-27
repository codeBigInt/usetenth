"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchRule } from "./api";
import { cleanName, MIXES, type Mix, type MixStock } from "./mixes";
import { telegramWebApp } from "./telegram";

export interface Settings {
  onboarded: boolean;
  percent: number;
  mixId: string;
  customStocks: MixStock[];
  holdWeekends: boolean;
  confirmEach: boolean;
}

const DEFAULTS: Settings = {
  onboarded: false,
  percent: 10,
  mixId: "steady",
  customStocks: [],
  holdWeekends: false,
  confirmEach: false,
};

const KEY = "usetenth:v1";
const HYDRATED_KEY = "usetenth:hydrated";

interface StoreValue {
  ready: boolean;
  settings: Settings;
  mix: Mix;
  update: (patch: Partial<Settings>) => void;
}

const Store = createContext<StoreValue | null>(null);

export function resolveMix(s: Settings): Mix {
  if (s.mixId === "custom") {
    return { id: "custom", name: "Your picks", blurb: "Stocks you chose yourself.", stocks: s.customStocks };
  }
  return MIXES.find((m) => m.id === s.mixId) ?? MIXES[0]!;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch {}
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (!ready || !telegramWebApp()) return;
    // Once per session: the account is the source of truth on first open, but a reload must not discard edits in progress.
    try {
      if (sessionStorage.getItem(HYDRATED_KEY)) return;
    } catch {}
    fetchRule()
      .then((rule) => {
        try {
          sessionStorage.setItem(HYDRATED_KEY, "1");
        } catch {}
        if (!rule) return;
        const preset = MIXES.some((m) => m.id === rule.mixId);
        update({
          onboarded: true,
          percent: rule.percent,
          holdWeekends: rule.holdWeekends,
          confirmEach: rule.confirmEach,
          mixId: preset ? rule.mixId! : "custom",
          ...(preset ? {} : { customStocks: rule.allocations.map((a) => ({ assetKey: a.assetKey, ticker: a.ticker, name: cleanName(a.name) })) }),
        });
      })
      .catch(() => undefined);
  }, [ready, update]);

  const value = useMemo(() => ({ ready, settings, mix: resolveMix(settings), update }), [ready, settings, update]);
  return <Store.Provider value={value}>{children}</Store.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(Store);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
