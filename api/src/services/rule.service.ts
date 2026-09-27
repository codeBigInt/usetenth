import { Asset, Rule, User } from "../models";
import { listInvestable } from "./assets.service";
import AppError from "./error";
import { equalPercentages, resolvePicks, type Pick } from "./rule.pure";
import type { TelegramUser } from "./telegram-auth";

export interface MyRuleInput {
  percent: number;
  mixId: string;
  picks: Pick[];
  holdWeekends: boolean;
  confirmEach: boolean;
}

export interface MyRuleView {
  percent: number;
  mixId: string | null;
  holdWeekends: boolean;
  confirmEach: boolean;
  allocations: { assetKey: string; ticker: string; name: string; percentage: string }[];
}

const RULE_TYPE = "PAYMENT_PERCENTAGE";

async function viewOf(rule: InstanceType<typeof Rule>): Promise<MyRuleView> {
  const keys = rule.allocations.map((a) => a.asset);
  const assets = await Asset.find({ assetKey: { $in: keys } }).select("assetKey ticker name symbol");
  const byKey = new Map(assets.map((a) => [a.assetKey, a]));
  return {
    percent: Number(rule.percentage),
    mixId: rule.mixId ?? null,
    holdWeekends: rule.holdWeekends,
    confirmEach: rule.confirmEach,
    allocations: rule.allocations.map((a) => {
      const asset = byKey.get(a.asset);
      return { assetKey: a.asset, ticker: asset?.ticker ?? a.asset, name: asset?.name ?? asset?.symbol ?? a.asset, percentage: a.percentage };
    }),
  };
}

export async function readMyRule(tg: TelegramUser): Promise<MyRuleView | null> {
  const user = await User.findOne({ telegramId: String(tg.id) });
  const rule = user && (await Rule.findOne({ userId: user._id, type: RULE_TYPE }));
  return rule ? viewOf(rule) : null;
}

export async function saveMyRule(tg: TelegramUser, input: MyRuleInput): Promise<MyRuleView & { skipped: string[] }> {
  const { resolved, skipped } = resolvePicks(input.picks, await listInvestable());
  if (resolved.length === 0) throw new AppError(400, "None of those stocks can be bought right now");

  const percentages = equalPercentages(resolved.length);
  const allocations = resolved.map((a, i) => ({ asset: a.assetKey, percentage: percentages[i]! }));

  const telegramId = String(tg.id);
  const user = await User.findOneAndUpdate({ telegramId }, { telegramId, telegramUsername: tg.username }, { upsert: true, new: true });
  const rule = await Rule.findOneAndUpdate(
    { userId: user._id, type: RULE_TYPE },
    { $set: { percentage: String(input.percent), allocations, enabled: true, mixId: input.mixId, holdWeekends: input.holdWeekends, confirmEach: input.confirmEach } },
    { upsert: true, new: true, runValidators: true },
  );
  return { ...(await viewOf(rule)), skipped };
}
