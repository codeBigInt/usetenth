"use client";

import { useEffect, useState } from "react";
import { fetchMe, type Me } from "./api";

export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchMe(controller.signal).then(setMe).catch(() => undefined);
    return () => controller.abort();
  }, []);
  return me;
}
