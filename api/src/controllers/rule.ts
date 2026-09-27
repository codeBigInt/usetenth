import type { Request, Response } from "express";
import { Rule } from "../models";
import { ruleBody, validate } from "../schemas";
import { listInvestable } from "../services/assets.service";
import AppError from "../services/error";
import { sendSuccess } from "../utils/http";

export async function createRule(req: Request, res: Response) {
  const { userId, ...rest } = validate(ruleBody, req.body);
  const investable = new Set((await listInvestable()).map((a) => a.assetKey));
  const unknown = rest.allocations.filter((a) => !investable.has(a.asset));
  if (unknown.length > 0) throw new AppError(400, `not investable: ${unknown.map((a) => a.asset).join(", ")}`);
  const rule = await Rule.create({ userId, type: "PAYMENT_PERCENTAGE", ...rest });
  return sendSuccess(res, "Rule created", rule, 201);
}
