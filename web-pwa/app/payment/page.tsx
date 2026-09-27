"use client";

import { Card, PrimaryButton, Screen, SecondaryButton } from "@/components/ui";
import { SAMPLE_PAYMENT } from "@/lib/config";
import { percentOf, splitEven, sub, usd } from "@/lib/money";
import { useStore } from "@/lib/store";

export default function PaymentPage() {
  const { settings, mix } = useStore();
  const invested = percentOf(SAMPLE_PAYMENT, settings.percent);
  const kept = sub(SAMPLE_PAYMENT, invested);
  const fills = splitEven(invested, mix.stocks.length);

  return (
    <Screen
      brand
      title="usetenth"
      subtitle="Example payment"
      footer={
        <div className="flex flex-col gap-3">
          <PrimaryButton href="/portfolio">See my portfolio</PrimaryButton>
          <SecondaryButton href="/tenth">Change my tenth</SecondaryButton>
        </div>
      }
    >
      <Card>
        <p className="text-sm text-mute">Payment received</p>
        <p className="num text-4xl font-semibold">{usd(SAMPLE_PAYMENT)}</p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-violet" style={{ width: `${settings.percent}%` }} />
        </div>
        <ul className="mt-3 space-y-1 text-[15px]">
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-violet" />{usd(invested)} invested</li>
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-mute/50" />{usd(kept)} ready to withdraw</li>
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm text-mute">Your {mix.name} mix, filled</h2>
        <ul className="divide-y divide-line">
          {mix.stocks.map((s, i) => (
            <li key={s.assetKey ?? s.ticker} className="flex justify-between py-2.5">
              <span>{s.name}</span>
              <span className="num">{usd(fills[i]!)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="px-1 text-sm text-mute">
        Fees and the price you paid are on each order. <span className="underline underline-offset-2">See the detail.</span>
      </p>
    </Screen>
  );
}
