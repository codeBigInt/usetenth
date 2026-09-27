import { Schema, model } from "mongoose";

const accountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["truemarkets"], default: "truemarkets" },
    externalAccountId: String,
    status: { type: String, enum: ["pending", "active", "restricted"], default: "pending" },
  },
  { timestamps: true },
);

export const Account = model("Account", accountSchema);
