"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Card, PrimaryButton, Screen, SecondaryButton } from "@/components/ui";
import { fetchSellQuote, placeSell, type SellPreview, type TradeResult } from "@/lib/api";
import { cleanName } from "@/lib/mixes";
import { usd, usdFine } from "@/lib/money";
import { useInTelegram } from "@/lib/telegram";
import { useMe } from "@/lib/useMe";

const short = (h: string) => (h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

function SellScreen() {
  const inTelegram = useInTelegram();
  const me = useMe();
  const assetKey = useSearchParams().get("asset") ?? "";
  const [preview, setPreview] = useState<SellPreview | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selling, setSelling] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<string>("");

  useEffect(() => {
    if (!assetKey || !inTelegram || me?.access == null) return;
    let stale = false;
    setQuoting(true);
    attempt.current = crypto.randomUUID();
    fetchSellQuote(assetKey)
      .then((p) => !stale && setPreview(p))
      .catch((e: Error) => !stale && setError(e.message))
      .finally(() => !stale && setQuoting(false));
    return () => {
      stale = true;
    };
  }, [assetKey, inTelegram, me?.access]);

  const sell = useCallback(async () => {
    if (!preview) return;
    setSelling(true);
    setError(null);
    try {
      setResult(await placeSell({ assetKey: preview.assetKey, minReceive: preview.receive, idempotencyKey: attempt.current }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConfirming(false);
      setSelling(false);
    }
  }, [preview]);

  if (!inTelegram || (me && me.access === null)) {
    return (
      <Screen back="/portfolio" title="Sell">
        <Card>
          <p className="font-medium">{inTelegram ? "The demo is invite-only." : "Open usetenth from Telegram to sell."}</p>
          <p className="mt-1 text-sm text-mute">Sales use the demo account, so they are only available inside the bot.</p>
        </Card>
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen back="/portfolio" title="Sale placed" footer={<PrimaryButton href="/portfolio">See my portfolio</PrimaryButton>}>
        <Card>
          <p className="text-sm text-mute">{result.status === "complete" ? "Sold" : "Submitted, still settling"}</p>
          <p className="num text-3xl font-semibold">{preview ? cleanName(preview.name) : "Your stock"}</p>
          <dl className="mt-3 space-y-2 text-sm">
            {preview ? <div className="flex justify-between"><dt className="text-mute">You get about</dt><dd className="num">{usd(preview.receive)}{preview.receiveAsset ? ` ${preview.receiveAsset}` : ""}</dd></div> : null}
            {result.txHash ? <div className="flex justify-between gap-4"><dt className="text-mute">Transaction</dt><dd className="num break-all text-right">{short(result.txHash)}</dd></div> : null}
          </dl>
        </Card>
        <p className="px-1 text-sm text-mute">The proceeds arrive as {preview?.receiveAsset ?? "stablecoin"} in the demo wallet. Check your portfolio in a minute.</p>
      </Screen>
    );
  }

  const tooSmall = !!preview && preview.issues.some((i) => /minimum/i.test(i));
  const blocked = !preview || !preview.enabled || preview.issues.length > 0 || quoting;

  return (
    <Screen
      back="/portfolio"
      title="Sell"
      footer={
        confirming && preview ? (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm">This sells <b>all {preview.qty}</b> of {cleanName(preview.name)} from the shared demo account.</p>
            <PrimaryButton onClick={sell} disabled={selling}>{selling ? "Selling…" : "Confirm and sell"}</PrimaryButton>
            <SecondaryButton onClick={() => setConfirming(false)} disabled={selling}>Cancel</SecondaryButton>
          </div>
        ) : (
          <PrimaryButton onClick={() => setConfirming(true)} disabled={blocked}>
            {preview ? `Sell ${cleanName(preview.name)}` : quoting ? "Getting a quote…" : "Sell"}
          </PrimaryButton>
        )
      }
    >
      {quoting ? <p className="px-1 text-sm text-mute">Getting a live quote…</p> : null}

      {preview ? (
        <Card>
          <p className="text-sm text-mute">Live quote</p>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-mute">You sell</dt><dd className="num">{preview.qty}</dd></div>
            <div className="flex justify-between"><dt className="text-mute">You get about</dt><dd className="num">{usd(preview.receive)}{preview.receiveAsset ? ` ${preview.receiveAsset}` : ""}</dd></div>
            {preview.price ? <div className="flex justify-between"><dt className="text-mute">Price each</dt><dd className="num">{usdFine(preview.price)}</dd></div> : null}
            <div className="flex justify-between"><dt className="text-mute">Fee</dt><dd className="num">{usdFine(preview.fee)}</dd></div>
          </dl>
          {tooSmall ? (
            <p className="mt-3 text-sm text-loss">
              True Markets needs a sale to be at least $1.00, and this holding is worth less. Buy a little more of it first, then sell.{" "}
              <Link href={`/buy?asset=${encodeURIComponent(preview.assetKey)}`} className="font-medium text-violet">Buy more</Link>
            </p>
          ) : preview.issues.length > 0 ? (
            <p className="mt-3 text-sm text-loss">{preview.issues.join(". ")}. This cannot go through.</p>
          ) : null}
          {!preview.enabled ? (
            <p className="mt-3 rounded-xl border border-line p-3 text-sm text-mute">Live test trades are switched off on the server, so this shows the quote only. Set TEST_BUY_ENABLED=true to allow a real sale.</p>
          ) : null}
        </Card>
      ) : null}

      {error ? (
        <Card>
          <p className="font-medium text-loss">{preview ? "That did not go through." : "Could not get a quote."}</p>
          <p className="mt-1 text-sm text-mute">{error}</p>
        </Card>
      ) : null}
    </Screen>
  );
}

export default function SellPage() {
  return (
    <Suspense>
      <SellScreen />
    </Suspense>
  );
}
