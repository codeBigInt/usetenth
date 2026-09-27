import type { Request, Response } from "express";
import { sellBody, sellQuoteBody, tradeBuyBody, tradeQuoteBody, validate } from "../schemas";
import type { TelegramUser } from "../services/telegram-auth";
import { previewBuy, previewSell, testBuy, testSell } from "../services/trade.service";
import { sendSuccess } from "../utils/http";

export async function quoteBuy(req: Request, res: Response) {
  const { assetKey, amount } = validate(tradeQuoteBody, req.body);
  return sendSuccess(res, "Quote", await previewBuy(assetKey, amount, res.locals.telegramUser as TelegramUser));
}

export async function buy(req: Request, res: Response) {
  const body = validate(tradeBuyBody, req.body);
  const result = await testBuy(res.locals.telegramUser as TelegramUser, body);
  return sendSuccess(res, "Order placed", result, 201);
}

export async function quoteSell(req: Request, res: Response) {
  const { assetKey } = validate(sellQuoteBody, req.body);
  return sendSuccess(res, "Sell quote", await previewSell(assetKey, res.locals.telegramUser as TelegramUser));
}

export async function sell(req: Request, res: Response) {
  const body = validate(sellBody, req.body);
  return sendSuccess(res, "Sale placed", await testSell(res.locals.telegramUser as TelegramUser, body), 201);
}
