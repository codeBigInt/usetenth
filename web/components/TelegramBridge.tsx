"use client";

import { useEffect } from "react";
import { telegramWebApp } from "@/lib/telegram";

/** Inside Telegram: tell it we are ready and fill the screen. */
export function TelegramBridge() {
  useEffect(() => {
    const app = telegramWebApp();
    if (!app) return;
    app.ready();
    app.expand();
  }, []);
  return null;
}
