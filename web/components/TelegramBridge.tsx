"use client";

import { useEffect } from "react";
import { saveTheme } from "@/lib/api";
import { telegramWebApp } from "@/lib/telegram";

/**
 * Inside Telegram: tell it we are ready, fill the screen, follow its light/dark scheme until the user picks one,
 * and report the scheme to the API. A bot cannot see the client's theme, so this is how its cards match.
 */
export function TelegramBridge() {
  useEffect(() => {
    const app = telegramWebApp();
    if (!app) return;
    app.ready();
    app.expand();
    const sync = () => {
      const scheme = app.colorScheme === "dark" ? "dark" : "light";
      try {
        if (!localStorage.getItem("usetenth:theme")) document.documentElement.classList.toggle("dark", scheme === "dark");
      } catch {}
      saveTheme(scheme).catch(() => undefined);
    };
    sync();
    app.onEvent?.("themeChanged", sync);
  }, []);
  return null;
}
