"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Chip, PrimaryButton, Screen, SecondaryButton } from "@/components/ui";
import { createDepositAddress, createWireInstructions, fetchDeposits, type Deposits } from "@/lib/api";
import { joinNames, labelOf, networkName } from "@/lib/networks";
import { useInTelegram } from "@/lib/telegram";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  return <SecondaryButton onClick={copy} className="mt-3 h-12 text-sm">{copied ? "Copied" : "Copy address"}</SecondaryButton>;
}

export default function AddFundsPage() {
  const inTelegram = useInTelegram();
  const [data, setData] = useState<Deposits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bankRequested, setBankRequested] = useState(false);

  useEffect(() => {
    if (!inTelegram) return;
    const params = new URLSearchParams(window.location.search);
    setBankRequested(params.get("method") === "bank");
    fetchDeposits()
      .then((d) => {
        setData(d);
        setSelected(params.get("network") ?? d.networks.find((n) => n.address)?.network ?? d.networks[0]?.network ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, [inTelegram]);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, []);

  const current = data?.networks.find((n) => n.network === selected) ?? null;

  if (!inTelegram) {
    return (
      <Screen back title="Add funds">
        <Card>
          <p className="font-medium">Open usetenth from Telegram to add funds.</p>
          <p className="mt-1 text-sm text-mute">Your deposit address belongs to your account, so it is only shown inside the bot. Send /deposit to get started.</p>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen back title="Add funds">
      {error ? (
        <Card>
          <p className="font-medium text-loss">Something went wrong.</p>
          <p className="mt-1 text-sm text-mute">{error}</p>
        </Card>
      ) : null}

      {!data && !error ? <p className="px-1 text-sm text-mute">Loading your deposit options…</p> : null}

      {data ? (
        <>
          <div>
            <h2 className="mb-2 px-1 text-sm text-mute">Choose a network for {data.asset}</h2>
            <div className="flex flex-wrap gap-2">
              {data.networks.map((n) => (
                <Chip key={n.network} active={selected === n.network} onClick={() => setSelected(n.network)} className="!flex-none px-5">
                  {networkName(n.network)}
                </Chip>
              ))}
            </div>
          </div>

          {current ? (
            <Card>
              <p className="text-sm text-mute">
                {data.asset} on <span className="font-semibold text-ink">{networkName(current.network)}</span>
                {current.source === "wallet" ? " · your wallet" : ""}
              </p>
              {current.address ? (
                <>
                  <p className="num mt-2 break-all rounded-xl bg-chip p-3 text-sm">{current.address}</p>
                  <CopyButton value={current.address} />
                  {current.source === "wallet" ? (
                    <p className="mt-3 text-sm text-mute">This is the wallet your usetenth balance lives in, so funds sent here appear in your account.</p>
                  ) : null}
                  {current.compatible.length > 0 ? (
                    <p className="mt-3 text-sm text-mute">This address also accepts {data.asset} sent on {joinNames(current.compatible)}.</p>
                  ) : null}
                </>
              ) : (
                data.canCreate ? (
                  <>
                    <p className="mt-2 text-sm text-mute">You do not have a {networkName(current.network)} address yet. It takes a moment to create and stays yours.</p>
                    <PrimaryButton
                      className="mt-3 h-12 text-sm"
                      disabled={busy !== null}
                      onClick={() => run("address", async () => setData({ ...data, ...(await createDepositAddress(current.network)) }))}
                    >
                      {busy === "address" ? "Creating…" : `Create my ${networkName(current.network)} address`}
                    </PrimaryButton>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-mute">
                    A {networkName(current.network)} address needs a verified account, which this account does not have yet. Use the network that shows an address for now.
                  </p>
                )
              )}
              <p className="mt-4 rounded-xl border border-loss/40 p-3 text-sm">
                Only send {data.asset} on {networkName(current.network)}. Any other asset or network can be lost for good.
              </p>
            </Card>
          ) : null}

          <Card className={bankRequested ? "border-violet" : ""}>
            <h2 className="font-medium">Add funds from a bank</h2>
            {data.wire.length > 0 ? (
              <dl className="mt-3 space-y-2 text-sm">
                {data.wire.flatMap((w, i) =>
                  Object.entries(w)
                    .filter(([, v]) => typeof v === "string" || typeof v === "number")
                    .map(([k, v]) => (
                      <div key={`${i}-${k}`} className="flex justify-between gap-4">
                        <dt className="text-mute">{labelOf(k)}</dt>
                        <dd className="num break-all text-right">{String(v)}</dd>
                      </div>
                    )),
                )}
              </dl>
            ) : (
              data.canCreate ? (
                <>
                  <p className="mt-1 text-sm text-mute">Send a bank wire and it arrives as dollars in your account. True Markets creates the transfer details for you.</p>
                  <SecondaryButton
                    className="mt-3 h-12 text-sm"
                    disabled={busy !== null}
                    onClick={() => run("wire", async () => setData({ ...data, wire: (await createWireInstructions()).wire }))}
                  >
                    {busy === "wire" ? "Setting up…" : "Set up bank transfer"}
                  </SecondaryButton>
                </>
              ) : (
                <p className="mt-1 text-sm text-mute">Bank transfers open up once your account is verified. Until then, add funds with a transfer to the address above.</p>
              )
            )}
          </Card>

          <p className="px-1 text-sm text-mute">When a payment lands we keep your tenth and invest it, and you get a message in Telegram.</p>
        </>
      ) : null}
    </Screen>
  );
}
