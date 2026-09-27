"use client";

import { useCallback, useState } from "react";
import { saveRule } from "./api";
import type { Mix } from "./mixes";
import { telegramWebApp } from "./telegram";

interface Settings {
  percent: number;
  holdWeekends: boolean;
  confirmEach: boolean;
}

/** Saves to the API when opened from Telegram; outside Telegram there is no account, so it only stays on this device. */
export function useSaveRule() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(async (s: Settings, mix: Mix): Promise<{ skipped: string[] }> => {
    if (!telegramWebApp()) return { skipped: [] };
    setSaving(true);
    setError(null);
    try {
      const rule = await saveRule({
        percent: s.percent,
        mixId: mix.id,
        holdWeekends: s.holdWeekends,
        confirmEach: s.confirmEach,
        picks: mix.stocks.map((x) => ({ assetKey: x.assetKey, ticker: x.ticker })),
      });
      return { skipped: rule.skipped };
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  return { persist, saving, error };
}
