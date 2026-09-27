import { createHash } from "node:crypto";
import type { Basket } from "../config/baskets";
import { dec, percentOf } from "../utils/money";
import { rebalancedSplit } from "./assets.service";

export interface RuleConfig {
  percent: string;
  minBatch: string;
  holdWeekends: boolean;
  paused: boolean;
}

export interface OrderIntent {
  idempotencyKey: string;
  assetKey: string;
  amount: string;
}

export interface PlanInput {
  userId: string;
  pendingBatchId: string;
  deposit: string;
  rule: RuleConfig;
  basket: Basket;
  investableKeys: ReadonlySet<string>;
  positionValues: Record<string, string>;
  pendingBefore: string;
  clock: Date;
}

export type PlanReason = "paused" | "below_minimum" | "weekend_hold" | "executed";

export interface PlanResult {
  tenth: string;
  residual: string;
  pendingAfter: string;
  intents: OrderIntent[];
  reason: PlanReason;
}

const MIN_NOTIONAL = "1.00";

export function isUsMarketOpen(clock: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(clock);

  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

  if (weekday === "Sat" || weekday === "Sun") return false;
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= 9 * 60 + 30 && minutesSinceMidnight < 16 * 60;
}

function idempotencyKey(userId: string, pendingBatchId: string, assetKey: string): string {
  return createHash("sha256").update(`${userId}:${pendingBatchId}:${assetKey}`).digest("hex");
}

export function plan(input: PlanInput): PlanResult {
  const { userId, pendingBatchId, deposit, rule, basket, investableKeys, positionValues, pendingBefore, clock } = input;

  if (rule.paused) {
    return { tenth: "0.00", residual: deposit, pendingAfter: pendingBefore, intents: [], reason: "paused" };
  }

  const tenth = percentOf(deposit, rule.percent);
  const residual = dec(deposit).minus(tenth).toFixed(2);
  const pendingAfter = dec(pendingBefore).plus(tenth).toFixed(2);

  if (dec(pendingAfter).lt(rule.minBatch)) {
    return { tenth, residual, pendingAfter, intents: [], reason: "below_minimum" };
  }

  if (rule.holdWeekends && !isUsMarketOpen(clock)) {
    return { tenth, residual, pendingAfter, intents: [], reason: "weekend_hold" };
  }

  const allocations = rebalancedSplit(pendingAfter, basket, positionValues);
  const intents: OrderIntent[] = [];
  let deployed = dec(0);

  for (const a of allocations) {
    // Unavailable or below the minimum notional: stays in pending.
    if (!investableKeys.has(a.assetKey) || dec(a.amount).lt(MIN_NOTIONAL)) continue;
    intents.push({ idempotencyKey: idempotencyKey(userId, pendingBatchId, a.assetKey), assetKey: a.assetKey, amount: a.amount });
    deployed = deployed.plus(a.amount);
  }

  const remainingPending = dec(pendingAfter).minus(deployed).toFixed(2);
  return { tenth, residual, pendingAfter: remainingPending, intents, reason: "executed" };
}
