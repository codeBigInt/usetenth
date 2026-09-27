import { Schema, model } from "mongoose";

const investmentEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // unique => a payment can only ever be invested once (idempotency)
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", required: true, unique: true },
    ruleId: { type: Schema.Types.ObjectId, ref: "Rule", required: true },
    sourceAmount: { type: String, required: true },
    investmentAmount: { type: String, required: true },
    status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
  },
  { timestamps: true },
);

export const InvestmentEvent = model("InvestmentEvent", investmentEventSchema);
