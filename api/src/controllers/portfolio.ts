import type { Request, Response } from "express";
import { User } from "../models";
import { getPortfolio } from "../services/portfolio.service";
import type { TelegramUser } from "../services/telegram-auth";
import { sendSuccess } from "../utils/http";

export async function readPortfolio(_req: Request, res: Response) {
  const tg = res.locals.telegramUser as TelegramUser | undefined;
  const user = tg ? await User.findOne({ telegramId: String(tg.id) }).select("_id") : null;
  return sendSuccess(res, "Portfolio", await getPortfolio(user ? String(user._id) : undefined));
}
