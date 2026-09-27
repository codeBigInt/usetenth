"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Card, Chip, PrimaryButton, Screen, SecondaryButton } from "@/components/ui";
import { fetchInvestable, fetchQuote, placeBuy, type InvestableAsset, type TradePreview, type TradeResult } from "@/lib/api";
import { cleanName } from "@/lib/mixes";
import { usd, usdFine } from "@/lib/money";
import { useInTelegram } from "@/lib/telegram";
import { useMe } from "@/lib/useMe";

const AMOUNTS = ["1.00", "2.00"];
const short = (h: string) => (h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

function BuyScreen() {
  const inTelegram = useInTelegram();
  const me = useMe();
  const wanted = useSearchParams().get("asset");
  const [stocks, setStocks] = useState<InvestableAsset[]>([]);
  const [assetKey, setAssetKey] = useState("");
  const [amount, setAmount] = useState("1.00");
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [buying, setBuying] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<string>("");

  useEffect(() => {
    if (!inTelegram) return;
    fetchInvestable()
      .then((all) => {
        const equities = all.filter((a) => a.kind === "equity").sort((a, b) => cleanName(a.displayName).localeCompare(cleanName(b.displayName)));
        setStocks(equities);
        setAssetKey((equities.find((a) => a.assetKey === wanted) ?? equities.find((a) => a.symbol === "AAPLC") ?? equities[0])?.assetKey ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, [inTelegram, wanted]);

  // A fresh quote means a fresh attempt id, so an old, failed attempt can never be replayed by accident.
  useEffect(() => {
    if (!assetKey || me?.access == null) return;
    let stale = false;
    setPreview(null);
    setConfirming(false);
    setError(null);
    setQuoting(true);
    attempt.current = crypto.randomUUID();
    const t = setTimeout(() => {
      fetchQuote(assetKey, amount)
        .then((p) => !stale && setPreview(p))
        .catch((e: Error) => !stale && setError(e.message))
        .finally(() => !stale && setQuoting(false));
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [assetKey, amount, me?.access]);

  const buy = useCallback(async () => {
    if (!preview) return;
    setBuying(true);
    setError(null);
    try {
      setResult(await placeBuy({ assetKey: preview.assetKey, amount: preview.amount, minQtyOut: preview.qtyOut, idempotencyKey: attempt.current }));
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
      setConfirming(false);
    } finally {
      setBuying(false);
    }
  }, [preview]);

  if (!inTelegram) {
    return (
      <Screen back title="Try a buy">
        <Card>
          <p className="font-medium">Open usetenth from Telegram to try a buy.</p>
          <p className="mt-1 text-sm text-mute">Buys use the demo account, so they are only available inside the bot.</p>
        </Card>
      </Screen>
    );
  }

  if (me && me.access === null) {
    return (
      <Screen back title="Try a buy">
        <Card>
          <p className="font-medium">The demo is invite-only.</p>
          <p className="mt-1 text-sm text-mute">Ask for an invite link and open it to unlock test buys.</p>
        </Card>
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen back="/portfolio" title="Order placed" footer={<PrimaryButton href="/portfolio">See my portfolio</PrimaryButton>}>
        <Card>
          <p className="text-sm text-mute">{result.status === "complete" ? "Bought" : "Submitted, still settling"}</p>
          <p className="num text-3xl font-semibold">{usd(amount)} of {preview?.name}</p>
          <dl className="mt-3 space-y-2 text-sm">
            {result.executedQty ? <div className="flex justify-between"><dt className="text-mute">You got</dt><dd className="num">{result.executedQty}</dd></div> : null}
            {result.price ? <div className="flex justify-between"><dt className="text-mute">Price</dt><dd className="num">{usd(result.price)}</dd></div> : null}
            {result.fee ? <div className="flex justify-between"><dt className="text-mute">Fee</dt><dd className="num">{usdFine(result.fee)}</dd></div> : null}
            {result.txHash ? <div className="flex justify-between gap-4"><dt className="text-mute">Transaction</dt><dd className="num break-all text-right">{short(result.txHash)}</dd></div> : null}
          </dl>
        </Card>
        <p className="px-1 text-sm text-mute">
          {result.status === "complete" ? "It is in your portfolio now." : "True Markets has it and is still confirming the fill. Check your portfolio in a minute."}
        </p>
      </Screen>
    );
  }

  const overLimit = !!preview && preview.remainingUsd !== null && Number(preview.amount) > Number(preview.remainingUsd);
  const blocked = !preview || !preview.enabled || preview.issues.length > 0 || quoting || overLimit;

  return (
    <Screen
      back="/portfolio"
      title="Try a buy"
      footer={
        confirming && preview ? (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm">This spends <b>{usd(preview.amount)}</b> of real funds from the shared demo account.</p>
            <PrimaryButton onClick={buy} disabled={buying}>{buying ? "Buying…" : "Confirm and buy"}</PrimaryButton>
            <SecondaryButton onClick={() => setConfirming(false)} disabled={buying}>Cancel</SecondaryButton>
          </div>
        ) : (
          <PrimaryButton onClick={() => setConfirming(true)} disabled={blocked}>
            {preview ? `Buy ${usd(preview.amount)} of ${preview.name}` : "Getting a quote…"}
          </PrimaryButton>
        )
      }
    >
      <Card>
        <label htmlFor="stock" className="text-sm text-mute">Stock</label>
        <select id="stock" value={assetKey} onChange={(e) => setAssetKey(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-line bg-card px-3">
          {stocks.map((s) => (
            <option key={s.assetKey} value={s.assetKey}>{cleanName(s.displayName)} ({s.assetKey.startsWith("base:") ? "Base" : "Robinhood"})</option>
          ))}
        </select>
        <p className="mb-2 mt-4 text-sm text-mute">Amount</p>
        <div className="flex gap-3">
          {AMOUNTS.map((a) => (
            <Chip key={a} active={amount === a} onClick={() => setAmount(a)} disabled={preview ? Number(a) > Number(preview.maxUsd) : false}>{usd(a)}</Chip>
          ))}
        </div>
      </Card>

      {quoting ? <p className="px-1 text-sm text-mute">Getting a live quote…</p> : null}

      {preview ? (
        <Card>
          <p className="text-sm text-mute">Live quote</p>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-mute">You spend</dt><dd className="num">{usd(preview.amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-mute">You get about</dt><dd className="num">{preview.qtyOut}</dd></div>
            {preview.price ? <div className="flex justify-between"><dt className="text-mute">Price each</dt><dd className="num">{usdFine(preview.price)}</dd></div> : null}
            <div className="flex justify-between"><dt className="text-mute">Fee</dt><dd className="num">{usdFine(preview.fee)}</dd></div>
            {preview.remainingUsd !== null ? (
              <div className="flex justify-between"><dt className="text-mute">Demo limit left</dt><dd className="num">{usd(preview.remainingUsd)}</dd></div>
            ) : null}
          </dl>
          {overLimit ? <p className="mt-3 text-sm text-loss">You have used your demo spending limit. Ask the demo owner to raise it (MAX_USER_SPEND_USD).</p> : null}
          {preview.issues.length > 0 ? <p className="mt-3 text-sm text-loss">{preview.issues.join(". ")}. This cannot go through.</p> : null}
          {!preview.enabled ? (
            <p className="mt-3 rounded-xl border border-line p-3 text-sm text-mute">Live test buys are switched off on the server, so this shows the quote only. Set TEST_BUY_ENABLED=true to allow a real buy.</p>
          ) : null}
        </Card>
      ) : null}

      {error ? (
        <Card>
          <p className="font-medium text-loss">{preview || result ? "That did not go through." : "Could not get a quote."}</p>
          <p className="mt-1 text-sm text-mute">{error}</p>
          <Link href="/buy" className="mt-2 inline-block text-sm font-medium text-violet" onClick={() => location.reload()}>Get a new quote</Link>
        </Card>
      ) : null}
    </Screen>
  );
}

export default function BuyPage() {
  return (
    <Suspense>
      <BuyScreen />
    </Suspense>
  );
}
