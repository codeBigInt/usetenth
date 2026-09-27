"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, Check, Chip, DotRing, PrimaryButton, Screen } from "@/components/ui";
import { summarize } from "@/lib/mixes";
import { useInTelegram } from "@/lib/telegram";
import { useSaveRule } from "@/lib/useSaveRule";
import { useStore } from "@/lib/store";

const PRESETS = [5, 10, 20];

export default function TenthPage() {
  const router = useRouter();
  const { ready, settings, mix, update } = useStore();
  const [percent, setPercent] = useState(10);
  const [custom, setCustom] = useState(false);
  const [holdWeekends, setHoldWeekends] = useState(false);
  const [confirmEach, setConfirmEach] = useState(false);
  const [skipped, setSkipped] = useState<string[] | null>(null);
  const inTelegram = useInTelegram();
  const { persist, saving, error } = useSaveRule();

  useEffect(() => {
    if (!ready) return;
    setPercent(settings.percent);
    setCustom(!PRESETS.includes(settings.percent));
    setHoldWeekends(settings.holdWeekends);
    setConfirmEach(settings.confirmEach);
  }, [ready, settings.percent, settings.holdWeekends, settings.confirmEach]);

  const save = async () => {
    update({ percent, holdWeekends, confirmEach });
    try {
      const result = await persist({ percent, holdWeekends, confirmEach }, mix);
      if (result.skipped.length > 0) setSkipped(result.skipped);
      else router.push("/portfolio");
    } catch {}
  };

  return (
    <Screen back title="Your tenth" footer={
        skipped ? (
          <PrimaryButton href="/portfolio">Continue</PrimaryButton>
        ) : (
          <>
            <PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</PrimaryButton>
            {!inTelegram ? <p className="mt-3 text-center text-sm text-mute">Saved on this device. Open usetenth from Telegram to save it to your account.</p> : null}
          </>
        )
      }>
      {skipped ? (
        <Card>
          <p className="font-medium">Saved, with some stocks left out.</p>
          <p className="mt-1 text-sm text-mute">These cannot be bought right now: {skipped.join(", ")}. The rest of your mix is saved.</p>
        </Card>
      ) : null}
      {error ? (
        <Card>
          <p className="font-medium text-loss">Could not save your tenth.</p>
          <p className="mt-1 text-sm text-mute">{error}</p>
        </Card>
      ) : null}

      <div className="flex flex-col items-center gap-2 py-2">
        <DotRing percent={percent} />
        <p className="num text-3xl font-semibold">{percent}%</p>
        <p className="text-center text-sm text-mute">One dot in ten. Raise it whenever you like.</p>
      </div>

      <div>
        <h2 className="mb-2 px-1 text-sm text-mute">Invest this much of every payment</h2>
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <Chip key={p} active={!custom && percent === p} onClick={() => { setCustom(false); setPercent(p); }}>
              {p}%
            </Chip>
          ))}
          <Chip active={custom} onClick={() => setCustom(true)}>Custom</Chip>
        </div>
        {custom ? (
          <label className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={percent}
              onChange={(e) => setPercent(Math.min(50, Math.max(1, Math.round(Number(e.target.value) || 1))))}
              className="num w-20 bg-transparent text-xl outline-none"
            />
            <span className="text-sm text-mute">% of each payment (1 to 50)</span>
          </label>
        ) : null}
      </div>

      <div>
        <h2 className="mb-2 px-1 text-sm text-mute">Mix</h2>
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-medium">{mix.name}</p>
            <p className="text-sm text-mute">{summarize(mix.stocks)}</p>
          </div>
          <Link href="/tenth/mix" className="font-medium text-violet">Change</Link>
        </Card>
      </div>

      <Card className="flex flex-col gap-4">
        <Check
          checked={holdWeekends}
          onChange={setHoldWeekends}
          label="Hold weekend deposits until Monday"
          hint="Stock markets are shut at weekends, so prices here can drift from the real open."
        />
        <Check
          checked={confirmEach}
          onChange={setConfirmEach}
          label="Ask me before each buy"
          hint="Off means usetenth invests the moment a payment lands."
        />
      </Card>
    </Screen>
  );
}
