"use client";

import { useEffect, useState } from "react";
import { Landing } from "@/components/Landing";
import { Setup } from "@/components/Setup";
import { telegramWebApp } from "@/lib/telegram";

export default function HomePage() {
  const [where, setWhere] = useState<"unknown" | "telegram" | "browser">("unknown");
  useEffect(() => setWhere(telegramWebApp() ? "telegram" : "browser"), []);

  if (where === "unknown") return null;
  return where === "telegram" ? <Setup /> : <Landing />;
}
