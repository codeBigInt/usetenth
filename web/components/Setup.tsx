"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Chip, PrimaryButton, Screen } from "@/components/ui";
import { SAMPLE_PAYMENT } from "@/lib/config";
import { MIXES } from "@/lib/mixes";
import { useSaveRule } from "@/lib/useSaveRule";
import { percentOf, sub, usd } from "@/lib/money";
import { useStore } from "@/lib/store";

const PERCENTS = [5, 10, 20];

export function Setup() {
  const router = useRouter();
  const { ready, settings, update } = useStore();
  const { persist, saving, error } = useSaveRule();
  const [percent, setPercent] = useState(10);
  const [mixId, setMixId] = useState("steady");

  useEffect(() => {
    if (ready && settings.onboarded) router.replace("/portfolio");
  }, [ready, settings.onboarded, router]);

  const invested = percentOf(SAMPLE_PAYMENT, percent);

  const start = async () => {
    update({ onboarded: true, percent, mixId });
    const mix = MIXES.find((m) => m.id === mixId) ?? MIXES[0]!;
    try {
      await persist({ percent, holdWeekends: false, confirmEach: false }, mix);
      router.push("/portfolio");
    } catch {}
  };

  return (
    <Screen
      brand
      title="usetenth"
      subtitle="Setting you up"
      footer={
        <>
          <PrimaryButton onClick={start} disabled={saving}>{saving ? "Saving…" : "Verify my identity"}</PrimaryButton>
          {error ? <p className="mt-3 text-center text-sm text-loss">{error}</p> : null}
          <p className="mt-3 text-center text-sm text-mute">About 3 minutes. Your keys stay yours.</p>
        </>
      }
    >
      <Card>
        <p className="text-[15px]">Two questions and you&apos;re set. You can change both later.</p>
      </Card>

      <Card>
        <h2 className="mb-3 text-[15px] font-medium">How much of each payment should I invest?</h2>
        <div className="flex gap-3">
          {PERCENTS.map((p) => (
            <Chip key={p} active={percent === p} onClick={() => setPercent(p)}>
              {p}%
            </Chip>
          ))}
        </div>
        <p className="mt-3 text-sm text-mute">
          On a {usd(SAMPLE_PAYMENT)} payment that is {usd(invested)} invested, {usd(sub(SAMPLE_PAYMENT, invested))} left for you.
        </p>
      </Card>

      <div>
        <h2 className="mb-3 px-1 text-[15px] font-medium">Pick your mix.</h2>
        <div className="flex flex-col gap-3">
          {MIXES.map((m) => {
            const on = mixId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMixId(m.id)}
                aria-pressed={on}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                  on ? "border-violet bg-violet/10" : "border-line bg-card/90"
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${on ? "border-violet" : "border-mute/60"}`}>
                  {on ? <span className="h-3 w-3 rounded-full bg-violet" /> : null}
                </span>
                <span>
                  <span className="block font-medium">{m.name}</span>
                  <span className="block text-sm text-mute">{m.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Screen>
  );
}
