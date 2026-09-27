import type { Request, Response } from "express";
import { Payment } from "../models";
import { paymentBody, validate } from "../schemas";
import { processPayment } from "../services/investment.service";
import { sendSuccess } from "../utils/http";

export async function recordPayment(req: Request, res: Response) {
  const body = validate(paymentBody, req.body);
  const payment = await Payment.findOneAndUpdate(
    { externalReference: body.externalReference },
    { $setOnInsert: { ...body, status: "confirmed" } },
    { upsert: true, new: true },
  );
  const investment = await processPayment(payment._id.toString());
  return sendSuccess(res, "Payment recorded", { payment, investment }, 201);
}
