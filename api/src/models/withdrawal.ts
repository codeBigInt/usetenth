import { Schema, model } from "mongoose";

const withdrawalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    amount: { type: String, required: true },
    asset: { type: String, required: true },
    network: String,
    destinationRef: String, // opaque id, not the raw address
    status: { type: String, enum: ["created", "pending", "complete", "failed"], default: "created" },
    providerTransferId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

export const Withdrawal = model("Withdrawal", withdrawalSchema);
