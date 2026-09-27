"use client";

import { useState } from "react";
import { Card, PrimaryButton, Screen } from "@/components/ui";
import { DEMO, WITHDRAW_TARGET } from "@/lib/config";
import { gt, toCents, usd } from "@/lib/money";
import { usePortfolio } from "@/lib/usePortfolio";

const AMOUNT = /^\d+(\.\d{1,2})?$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export default function WithdrawPage() {
  const { portfolio } = usePortfolio();
  const withdrawable = portfolio?.cash ?? "0.00";
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");

  const amountOk = AMOUNT.test(amount) && toCents(amount) > toCents("0") && !gt(amount, withdrawable);
  const addressOk = ADDRESS.test(address);
  const canSubmit = amountOk && addressOk && !DEMO;

  return (
    <Screen
      back
      title="Withdraw"
      footer={
        <>
          <PrimaryButton disabled={!canSubmit}>Withdraw {amountOk ? usd(amount) : ""}</PrimaryButton>
          {DEMO ? <p className="mt-3 text-center text-sm text-mute">Withdrawals are switched off in demo mode.</p> : null}
        </>
      }
    >
      <div className="px-1">
        <p className="text-sm text-mute">Ready to withdraw now</p>
        <p className="num text-5xl font-semibold tracking-tight">{usd(withdrawable)}</p>
        <p className="mt-2 text-sm text-mute">This is the part of your payments that was never invested. Nothing has to be sold.</p>
      </div>

      <div>
        <label htmlFor="amount" className="mb-2 block px-1 text-sm">Amount</label>
        <div className="flex items-center rounded-2xl border border-line bg-card px-4">
          <span className="num text-lg text-mute">$</span>
          <input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!amountOk}
            className="num h-14 flex-1 bg-transparent pl-1 text-lg outline-none"
          />
        </div>
        {!amountOk && amount !== "" ? <p className="mt-1 px-1 text-sm text-loss">Enter an amount up to {usd(withdrawable)}.</p> : null}
        <button onClick={() => setAmount(withdrawable)} className="mt-2 rounded-full bg-chip px-4 py-2 text-sm">Withdraw all</button>
      </div>

      <div>
        <label htmlFor="address" className="mb-2 block px-1 text-sm">Send to</label>
        <input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="Your wallet address (0x…)"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={address !== "" && !addressOk}
          className="num h-14 w-full rounded-2xl border border-line bg-card px-4 text-sm outline-none"
        />
        {address !== "" && !addressOk ? <p className="mt-1 px-1 text-sm text-loss">That is not a valid {WITHDRAW_TARGET.network} address.</p> : null}
        <p className="mt-2 px-1 text-sm text-mute">
          {WITHDRAW_TARGET.asset} on {WITHDRAW_TARGET.network}. Sending to another network will lose the funds.
        </p>
      </div>

      <Card className="space-y-2 text-[15px]">
        <div className="flex justify-between"><span className="text-mute">Network fee</span><span>Shown before you confirm</span></div>
        <div className="flex justify-between"><span className="text-mute">Arrives in</span><span>About a minute</span></div>
      </Card>

    </Screen>
  );
}
