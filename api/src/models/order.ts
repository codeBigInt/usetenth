import { Schema, model } from "mongoose";

const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // absent for manual trades placed from the UI
    investmentEventId: { type: Schema.Types.ObjectId, ref: "InvestmentEvent" },
    // caller-supplied; the row is written before any outbound call
    idempotencyKey: { type: String, required: true, unique: true },
    asset: { type: String, required: true }, // TODO: chain:address key (Module 5)
    settlementAsset: { type: String, required: true },
    side: { type: String, enum: ["buy", "sell"], required: true },
    amount: { type: String, required: true },
    amountUnit: { type: String, enum: ["quote", "base"], default: "quote" },
    status: {
      type: String,
      enum: ["created", "quoted", "awaiting_user", "rejected_slippage", "initialized", "pending", "active", "complete", "cancel_pending", "canceled", "failed"],
      default: "created",
      index: true,
    },
    provider: { type: String, default: "truemarkets" },
    providerOrderId: { type: String, unique: true, sparse: true },
    venue: String,
    quoteId: String,
    txHash: String,
    quotedOut: String,
    historyId: { type: String, unique: true, sparse: true },
    failureReason: String,
  },
  { timestamps: true },
);
// a retried worker can't create a second order for the same asset in one event
orderSchema.index({ investmentEventId: 1, asset: 1 }, { unique: true, partialFilterExpression: { investmentEventId: { $exists: true } } });

export const Order = model("Order", orderSchema);
