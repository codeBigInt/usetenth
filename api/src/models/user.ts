import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    telegramId: { type: String, unique: true, sparse: true },
    telegramUsername: String,
    email: { type: String, unique: true, sparse: true },
    access: { type: String, enum: ["judge"] },
    invitedWith: String,
  },
  { timestamps: true },
);

export const User = model("User", userSchema);
