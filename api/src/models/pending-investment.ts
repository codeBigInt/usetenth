import { Schema, model } from "mongoose";

// The tenth waiting for min_batch. One doc per user; adjust only with $inc-style ledger code.
const pendingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    asset: { type: String, required: true },
    amount: { type: String, required: true, default: "0" },
  },
  { timestamps: true },
);

export const PendingInvestment = model("PendingInvestment", pendingSchema);
