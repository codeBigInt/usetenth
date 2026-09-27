import { Schema, model } from "mongoose";

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    externalReference: { type: String, required: true, unique: true },
    asset: { type: String, required: true },
    amount: { type: String, required: true },
    status: { type: String, enum: ["pending", "confirmed", "processed", "failed"], default: "pending" },
    source: String,
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const Payment = model("Payment", paymentSchema);
