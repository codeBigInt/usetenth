import { Schema, model } from "mongoose";

const updateSchema = new Schema({
  updateId: { type: Number, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, index: { expireAfterSeconds: 7 * 24 * 60 * 60 } },
});

export const TelegramUpdate = model("TelegramUpdate", updateSchema);
