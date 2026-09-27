import { randomUUID, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import AppError from "../services/error";
import { hasDemoAccess } from "../services/owner";
import { verifyInitData, type TelegramUser } from "../services/telegram-auth";
import { sendError } from "../utils/http";

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header("x-request-id") ?? randomUUID();
  res.setHeader("x-request-id", requestId);
  res.locals.requestId = requestId;
  next();
}

export function telegramWebhookAuth(req: Request, _res: Response, next: NextFunction) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || req.header("x-telegram-bot-api-secret-token") !== env.TELEGRAM_WEBHOOK_SECRET)
    throw new AppError(403, "Forbidden");
  next();
}

/** Optional identity: `Authorization: tma <initData>` from the Telegram web app. No header means the public demo. */
export function telegramUserAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("tma ")) return next();
  if (!env.TELEGRAM_BOT_TOKEN) throw new AppError(503, "Telegram is not configured");
  const user = verifyInitData(header.slice(4), env.TELEGRAM_BOT_TOKEN);
  if (!user) throw new AppError(401, "Invalid Telegram session");
  res.locals.telegramUser = user;
  next();
}

/** Routes that act on the shared demo account: its owner or an invited tester, verified through Telegram. */
export async function requireDemoAccess(_req: Request, res: Response, next: NextFunction) {
  const tg = res.locals.telegramUser as TelegramUser | undefined;
  if (!tg) throw new AppError(401, "Open usetenth from Telegram to use this");
  if (!(await hasDemoAccess(tg))) throw new AppError(403, "The demo is invite-only. Ask for an invite link and open it to get access.");
  next();
}

/** Server-to-server routes: closed unless ADMIN_API_KEY is set, and then only with a matching `x-admin-key`. */
export function requireAdminKey(req: Request, _res: Response, next: NextFunction) {
  if (!env.ADMIN_API_KEY) throw new AppError(503, "Admin routes are not configured");
  const given = Buffer.from(req.header("x-admin-key") ?? "");
  const wanted = Buffer.from(env.ADMIN_API_KEY);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) throw new AppError(401, "Invalid admin key");
  next();
}

export function notFoundHandler(_req: Request, res: Response) {
  return sendError(res, "Not found", null, 404);
}

export function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction) {
  const requestId = res.locals.requestId as string | undefined;
  if (error instanceof AppError) return sendError(res, error.message, { requestId }, error.statusCode);
  const status = (error as { status?: number }).status;
  if (status && status >= 400 && status < 500) return sendError(res, "Invalid request body", { requestId }, status);
  console.error("Unhandled error", { requestId, error });
  return sendError(res, "Internal server error", { requestId }, 500);
}
