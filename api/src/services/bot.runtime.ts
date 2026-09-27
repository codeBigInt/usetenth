import { webAppUrl } from "../config/web";
import { env } from "../config/env";
import { Account, TelegramUpdate, User } from "../models";
import { cleanName } from "../utils/names";
import { renderCard } from "./cards";
import { readMyRule } from "./rule.service";
import { defaultDeposit } from "./deposit.service";
import { hasDemoAccess, redeemInvite } from "./owner";
import { handleUpdate, type BotDeps, type TelegramUpdate as Update } from "./bot";
import { getPortfolio } from "./portfolio.service";
import { sendMessage, sendPhoto } from "./telegram";

const MIX_NAMES: Record<string, string> = { steady: "Steady", growth: "Growth", tech: "Tech-heavy", custom: "Your picks" };

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

const deps: BotDeps = {
  send: sendMessage,
  webUrl: webAppUrl,
  demo: env.APP_MODE === "demo",
  // Demo: one shared True Markets account, linked to the first user who starts the bot.
  register: async (from) => {
    const telegramId = String(from.id);
    const user = await User.findOneAndUpdate({ telegramId }, { telegramId, telegramUsername: from.username }, { upsert: true, new: true });
    await Account.findOneAndUpdate({ externalAccountId: "demo" }, { $setOnInsert: { userId: user._id, status: "active" } }, { upsert: true });
  },
  getPortfolio: async () => {
    const p = await getPortfolio();
    return {
      cash: p.cash,
      value: p.value,
      invested: p.invested,
      gain: p.gain,
      holdings: p.holdings.map((h) => ({ name: cleanName(h.name), amount: h.value ?? h.cost ?? "0.00" })),
    };
  },
  card: renderCard,
  getTheme: async (from) => (await User.findOne({ telegramId: String(from.id) }).select("theme"))?.theme ?? null,
  getDeposit: async (from) => ((await hasDemoAccess(from)) ? defaultDeposit() : null),
  redeemInvite,
  getSellable: async (from) => {
    if (!(await hasDemoAccess(from))) return null;
    const user = await User.findOne({ telegramId: String(from.id) }).select("_id");
    if (!user) return [];
    const p = await getPortfolio(String(user._id));
    return p.holdings.filter((h) => h.owned && Number(h.owned) > 0).map((h) => ({ assetKey: h.assetKey, name: cleanName(h.name), value: h.value }));
  },
  testBuyMaxUsd: env.TEST_BUY_ENABLED ? env.TEST_BUY_MAX_USD : null,
  sendPhoto,
  getRule: async (from) => {
    const rule = await readMyRule(from);
    return rule ? { percent: rule.percent, mixName: MIX_NAMES[rule.mixId ?? ""] ?? "Your picks" } : null;
  },
  claimUpdate: async (updateId) => {
    try {
      await TelegramUpdate.create({ updateId });
      return true;
    } catch (e) {
      if (isDuplicateKey(e)) return false;
      throw e;
    }
  },
};

export const processUpdate = (update: Update) => handleUpdate(update, deps);
