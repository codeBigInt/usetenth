import { Schema, model } from "mongoose";

const assetSchema = new Schema(
  {
    assetKey: { type: String, required: true, unique: true },
    symbol: { type: String, required: true },
    ticker: { type: String, required: true },
    name: String,
    chain: String,
    address: String,
    venue: { type: String, enum: ["defi", "cefi"], required: true },
    assetClass: { type: String, enum: ["crypto", "stock"], required: true },
    tradeable: { type: Boolean, default: false },
    stable: { type: Boolean, default: false },
    providerId: String,
    networks: { type: [{ _id: false, network: String, compatible: [String] }], default: [] },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const Asset = model("Asset", assetSchema);
