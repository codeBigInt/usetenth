import type { Request, Response } from "express";
import { env } from "../config/env";
import { User } from "../models";
import { myRuleBody, validate } from "../schemas";
import AppError from "../services/error";
import { accessOf } from "../services/owner";
import { readMyRule, saveMyRule } from "../services/rule.service";
import type { TelegramUser } from "../services/telegram-auth";
import { sendSuccess } from "../utils/http";

export async function readMe(_req: Request, res: Response) {
  const user = res.locals.telegramUser as TelegramUser | undefined;
  return sendSuccess(res, "Me", {
    user: user ? { id: user.id, firstName: user.first_name ?? null, username: user.username ?? null } : null,
    mode: env.APP_MODE,
    access: user ? await accessOf(user) : null,
    testBuy: env.TEST_BUY_ENABLED,
  });
}

function telegramUserOrFail(res: Response): TelegramUser {
  const user = res.locals.telegramUser as TelegramUser | undefined;
  if (!user) throw new AppError(401, "Open usetenth from Telegram to use your account");
  return user;
}

export async function readRule(_req: Request, res: Response) {
  return sendSuccess(res, "Your rule", { rule: await readMyRule(telegramUserOrFail(res)) });
}

export async function saveRule(req: Request, res: Response) {
  const rule = await saveMyRule(telegramUserOrFail(res), validate(myRuleBody, req.body));
  return sendSuccess(res, "Rule saved", { rule });
}
