import type { Request, Response } from "express";
import { processUpdate } from "../services/bot.runtime";
import type { TelegramUpdate } from "../services/bot";
import { sendSuccess } from "../utils/http";

export function handleWebhook(req: Request, res: Response) {
  sendSuccess(res, "ok", null);
  void processUpdate(req.body as TelegramUpdate).catch((error) => console.error("Telegram update failed", (error as Error).message));
}
