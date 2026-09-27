"use client";

import { useEffect, useState } from "react";

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { first_name?: string } };
  ready: () => void;
  expand: () => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const telegramWebApp = (): TelegramWebApp | null => {
  if (typeof window === "undefined") return null;
  const app = window.Telegram?.WebApp;
  return app?.initData ? app : null;
};

/** Signed proof of who opened the app from Telegram; empty outside Telegram (public demo). */
export const authHeaders = (): Record<string, string> => {
  const app = telegramWebApp();
  return app ? { Authorization: `tma ${app.initData}` } : {};
};

export function useInTelegram(): boolean {
  const [inTelegram, setInTelegram] = useState(false);
  useEffect(() => setInTelegram(telegramWebApp() !== null), []);
  return inTelegram;
}
