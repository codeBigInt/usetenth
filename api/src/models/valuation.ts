import { Schema, model } from "mongoose";

// Daily snapshot per user; there is no price history for Base tokens, so this can't be backfilled.
const valuationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: String, required: true }, // YYYY-MM-DD, UTC
  totalValue: { type: String, required: true },
  invested: { type: String, required: true },
  settlementAsset: { type: String, required: true },
});
valuationSchema.index({ userId: 1, day: 1 }, { unique: true });

export const Valuation = model("Valuation", valuationSchema);
