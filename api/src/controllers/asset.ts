import type { Request, Response } from "express";
import { listInvestable } from "../services/assets.service";
import { sendSuccess } from "../utils/http";

export async function getInvestableAssets(_req: Request, res: Response) {
  const assets = await listInvestable();
  return sendSuccess(res, "Investable assets", { requestId: res.locals.requestId, assets });
}
