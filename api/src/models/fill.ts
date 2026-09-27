import { Schema, model } from "mongoose";

// Append-only.
const fillSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    assetKey: { type: String, required: true }, // chain:address
    side: { type: String, enum: ["buy", "sell"], required: true },
    quantity: { type: String, required: true },
    price: { type: String, required: true },
    fee: { type: String, default: "0" },
    notional: String,
    settlementAsset: { type: String, required: true },
    filledAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const Fill = model("Fill", fillSchema);
