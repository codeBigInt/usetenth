import { Schema, model } from "mongoose";

const depositSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transferId: { type: String, required: true, unique: true }, // the whole double-spend guard
    amount: { type: String, required: true },
    asset: { type: String, required: true },
    seenAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const Deposit = model("Deposit", depositSchema);
