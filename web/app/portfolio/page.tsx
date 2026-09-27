"use client";

import Link from "next/link";
import { Card, PrimaryButton, Screen, SecondaryButton, ThemeToggle } from "@/components/ui";
import { API_URL, SAMPLE_PAYMENT } from "@/lib/config";
import { cleanName } from "@/lib/mixes";
import { isNegative, percentOf, signedUsd, sub, usd } from "@/lib/money";
import { useStore } from "@/lib/store";
import { useMe } from "@/lib/useMe";
import { usePortfolio } from "@/lib/usePortfolio";

export default function PortfolioPage() {
  const { settings } = useStore();
  const { portfolio, error, loading } = usePortfolio();
  const me = useMe();

  const nextPercent = Math.min(50, settings.percent + 2);
  const nowTenth = percentOf(SAMPLE_PAYMENT, settings.percent);
  const nextTenth = percentOf(SAMPLE_PAYMENT, nextPercent);

  return (
    <Screen
      brand
      title="Portfolio"
      right={<ThemeToggle />}
      subtitle={me?.user?.firstName ? `Hi, ${me.user.firstName}` : undefined}
      footer={
        <div className="flex gap-3">
          <PrimaryButton href="/withdraw" className="flex-[1.4]">Withdraw</PrimaryButton>
          <SecondaryButton href="/add-funds" className="flex-1">Add funds</SecondaryButton>
        </div>
      }
    >
      {error ? (
        <Card>
          <p className="font-medium">Couldn&apos;t load your portfolio.</p>
          <p className="mt-1 text-sm text-mute">Is the API running at {API_URL}? {error}</p>
        </Card>
      ) : loading || !portfolio ? (
        <p className="px-1 pt-2 text-sm text-mute">Loading your portfolio…</p>
      ) : (
        <>
          <div className="px-1 pt-2">
            <p className="text-sm text-mute">Worth today</p>
            <p className="num text-5xl font-semibold tracking-tight">{usd(portfolio.value)}</p>
            {portfolio.gain !== null ? (
              <p className={`num mt-1 text-sm ${isNegative(portfolio.gain) ? "text-loss" : "text-gain"}`}>
                {isNegative(portfolio.gain) ? "↓" : "↑"} {signedUsd(portfolio.gain)} since you started
              </p>
            ) : (
              <p className="mt-1 text-sm text-mute">{portfolio.holdings.length === 0 ? "Nothing invested yet." : "Waiting for your purchases to settle."}</p>
            )}
          </div>

          <Card className="flex justify-between">
            <div>
              <p className="text-sm text-mute">Invested so far</p>
              <p className="num text-2xl">{usd(portfolio.invested)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-mute">Ready to withdraw</p>
              <p className="num text-2xl">{usd(portfolio.cash)}</p>
            </div>
          </Card>

          <div>
            <h2 className="mb-2 px-1 text-sm text-mute">Holdings</h2>
            {portfolio.holdings.length === 0 ? (
              <Card>
                <p className="text-sm text-mute">Your first payment will show up here, split across your mix.</p>
              </Card>
            ) : (
              <Card className="divide-y divide-line p-0">
                {portfolio.holdings.map((h) => {
                  const g = h.value !== null && h.cost !== null ? sub(h.value, h.cost) : null;
                  return (
                    <div key={h.assetKey} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{cleanName(h.name)}</p>
                        <p className="text-sm text-mute">{h.cost !== null ? `${usd(h.cost)} invested` : `${h.quantity} held`}</p>
                      </div>
                      <div className="text-right">
                        <p className="num">{h.value !== null ? usd(h.value) : "-"}</p>
                        {g !== null ? <p className={`num text-sm ${isNegative(g) ? "text-loss" : "text-gain"}`}>{signedUsd(g)}</p> : null}
                      </div>
                      {me?.access && Number(h.owned) > 0 ? (
                        <Link href={`/sell?asset=${encodeURIComponent(h.assetKey)}`} className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-violet">Sell</Link>
                      ) : null}
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        </>
      )}

      {me?.access ? (
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-medium">Try a buy</p>
            <p className="text-sm text-mute">Buy a small amount of a real stock with the demo account.</p>
          </div>
          <Link href="/buy" className="font-medium text-violet">Open</Link>
        </Card>
      ) : null}

      {nextPercent > settings.percent ? (
        <section className="rounded-2xl bg-lime p-4 text-[#12131a]">
          <p className="font-semibold">Raise your tenth?</p>
          <p className="mt-1 text-sm">
            At {nextPercent}%, a {usd(SAMPLE_PAYMENT)} payment would invest {usd(nextTenth)} instead of {usd(nowTenth)}.
          </p>
          <Link href="/tenth" className="mt-3 inline-block font-semibold text-violet underline underline-offset-2">
            Raise my tenth
          </Link>
        </section>
      ) : null}
    </Screen>
  );
}
