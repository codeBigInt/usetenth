import { env } from "../config/env";
import { Account, User } from "../models";
import type { TelegramUser } from "./telegram-auth";

export type Access = "owner" | "judge";

/** The demo runs on one shared account: its owner (linked on first /start) and invited testers may use it. */
export async function accessOf(tg: TelegramUser): Promise<Access | null> {
  const account = await Account.findOne({ externalAccountId: "demo" });
  const owner = account && (await User.findById(account.userId));
  if (owner?.telegramId === String(tg.id)) return "owner";
  const user = await User.findOne({ telegramId: String(tg.id) }).select("access");
  return user?.access === "judge" ? "judge" : null;
}

export const hasDemoAccess = async (tg: TelegramUser) => (await accessOf(tg)) !== null;

export const inviteCodes = () => (env.INVITE_CODES ?? "").split(",").map((c) => c.trim()).filter(Boolean);

export const isValidInvite = (code: string, codes = inviteCodes()) => codes.some((c) => c.toLowerCase() === code.trim().toLowerCase());

/** Redeems an invite code from `/start <code>`. The owner already has access and is left as they are. */
export async function redeemInvite(tg: TelegramUser, code: string): Promise<"granted" | "invalid" | "owner"> {
  if ((await accessOf(tg)) === "owner") return "owner";
  if (!isValidInvite(code)) return "invalid";
  const telegramId = String(tg.id);
  await User.findOneAndUpdate({ telegramId }, { telegramId, telegramUsername: tg.username, access: "judge", invitedWith: code.trim() }, { upsert: true });
  return "granted";
}
