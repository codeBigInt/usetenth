import { Schema, model } from "mongoose";

// Derived cache; always rebuildable from fills. Stores quantity + costTotal, never the average.
const positionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assetKey: { type: String, required: true },
    quantity: { type: String, required: true, default: "0" },
    costTotal: { type: String, required: true, default: "0" },
    realizedGain: { type: String, required: true, default: "0" },
  },
  { timestamps: true },
);
positionSchema.index({ userId: 1, assetKey: 1 }, { unique: true });

export const Position = model("Position", positionSchema);
