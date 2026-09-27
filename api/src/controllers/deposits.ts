import type { Request, Response } from "express";
import { depositAddressBody, validate } from "../schemas";
import { createWireInstructions, depositOptions, ensureDepositAddress, listWireInstructions } from "../services/deposit.service";
import { sendSuccess } from "../utils/http";

export async function readDeposits(_req: Request, res: Response) {
  const [view, wire] = await Promise.all([depositOptions(), listWireInstructions().catch(() => [])]);
  return sendSuccess(res, "Deposit options", { ...view, wire });
}

export async function createAddress(req: Request, res: Response) {
  const { network } = validate(depositAddressBody, req.body);
  return sendSuccess(res, "Deposit address ready", await ensureDepositAddress(network), 201);
}

export async function createWire(_req: Request, res: Response) {
  return sendSuccess(res, "Bank transfer details", { wire: await createWireInstructions() }, 201);
}
