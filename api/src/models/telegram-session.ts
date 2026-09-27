import { Schema, model } from "mongoose";

const sessionSchema = new Schema({
  telegramUserId: { type: String, required: true, unique: true },
  state: {
    type: String,
    enum: ["idle", "awaiting_percentage", "awaiting_asset", "awaiting_allocation"],
    default: "idle",
  },
  data: Schema.Types.Mixed,
  // TTL index: Mongo deletes the doc once expiresAt passes
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const TelegramSession = model("TelegramSession", sessionSchema);
