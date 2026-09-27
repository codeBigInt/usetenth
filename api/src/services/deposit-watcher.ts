import { Deposit } from "../models";
import { normalizeHistory } from "./history.pure";

export interface IncomingTransfer {
  transferId: string;
  userId: string;
  amount: string;
  asset: string;
}

export type DepositObserved = IncomingTransfer;

export function historyToIncoming(items: unknown[], userId: string): IncomingTransfer[] {
  const out: IncomingTransfer[] = [];
  for (const raw of items) {
    const h = normalizeHistory(raw);
    const inbound = h.action === "DEPOSIT" || h.action === "RECEIVE";
    if (!inbound || h.status !== "SUCCESS" || !h.id || !h.amount || !h.toAsset) continue;
    out.push({ transferId: h.id, userId, amount: h.amount, asset: h.toAsset });
  }
  return out;
}

export interface DepositWatcherDeps {
  fetchIncoming: () => Promise<IncomingTransfer[]>;
  insertDeposit: (t: IncomingTransfer) => Promise<boolean>;
}

// The unique index on transferId is the double-spend guard: insert first, emit second.
export async function insertDeposit(t: IncomingTransfer): Promise<boolean> {
  try {
    await Deposit.create({ userId: t.userId, transferId: t.transferId, amount: t.amount, asset: t.asset });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false;
    throw e;
  }
}

export async function pollOnce(deps: DepositWatcherDeps): Promise<DepositObserved[]> {
  const observed: DepositObserved[] = [];
  for (const t of await deps.fetchIncoming()) {
    if (await deps.insertDeposit(t)) observed.push(t);
  }
  return observed;
}

export class DepositPoller {
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;

  constructor(
    private readonly deps: DepositWatcherDeps,
    private readonly onDeposit: (d: DepositObserved) => Promise<void>,
    private readonly intervalMs = 30_000,
  ) {}

  start() {
    this.timer = setInterval(() => {
      if (this.inFlight) return;
      this.inFlight = pollOnce(this.deps)
        .then(async (observed) => {
          for (const d of observed) await this.onDeposit(d);
        })
        .catch((e) => console.error("Deposit poll failed", e))
        .finally(() => (this.inFlight = undefined));
    }, this.intervalMs);
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }
}
