import { Schema, model } from "mongoose";
import { sumsTo100 } from "../utils/money";

const allocationSchema = new Schema(
  { asset: { type: String, required: true }, percentage: { type: String, required: true } },
  { _id: false },
);

const ruleSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["PAYMENT_PERCENTAGE", "FIXED_AMOUNT", "SCHEDULED_PERCENTAGE"],
      required: true,
    },
    percentage: String,
    fixedAmount: String,
    minimumAmount: String,
    enabled: { type: Boolean, default: true },
    mixId: String,
    holdWeekends: { type: Boolean, default: false },
    confirmEach: { type: Boolean, default: false },
    allocations: {
      type: [allocationSchema],
      default: [],
      validate: {
        validator: (a: { percentage: string }[]) =>
          a.length === 0 || sumsTo100(a.map((x) => x.percentage)),
        message: "Allocation percentages must sum to 100",
      },
    },
  },
  { timestamps: true },
);

export const Rule = model("Rule", ruleSchema);
