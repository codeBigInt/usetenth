import type { Request, Response } from "express";
import { User } from "../models";
import { userBody, validate } from "../schemas";
import { sendSuccess } from "../utils/http";

export async function upsertUser(req: Request, res: Response) {
  const { telegramId, telegramUsername } = validate(userBody, req.body);
  const user = await User.findOneAndUpdate({ telegramId }, { telegramId, telegramUsername }, { upsert: true, new: true });
  return sendSuccess(res, "User ready", user, 201);
}
