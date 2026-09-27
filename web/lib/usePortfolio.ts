"use client";

import { useEffect, useState } from "react";
import { fetchPortfolio, type Portfolio } from "./api";

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchPortfolio(controller.signal)
      .then(setPortfolio)
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      });
    return () => controller.abort();
  }, []);

  return { portfolio, error, loading: portfolio === null && error === null };
}
