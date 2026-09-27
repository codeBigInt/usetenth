import { z } from "zod";
import { env } from "../config/env";
import AppError from "../services/error";

const decimalStr = z.string().regex(/^\d+(\.\d+)?$/);

export const userBody = z.object({
  telegramId: z.string(),
  telegramUsername: z.string().optional(),
});

export const ruleBody = z.object({
  userId: z.string(),
  percentage: decimalStr.default("10"),
  minimumAmount: decimalStr.optional(),
  allocations: z.array(z.object({ asset: z.string(), percentage: decimalStr })),
  // .refine((a) => sumsTo100(a.map((x) => x.percentage)), "allocations must sum to 100"),
});

export const myRuleBody = z.object({
  percent: z.number().int().min(1).max(50),
  mixId: z.string().min(1).max(40),
  picks: z
    .array(z.object({ assetKey: z.string().optional(), ticker: z.string().optional() }).refine((p) => p.assetKey || p.ticker, "each pick needs a ticker or asset"))
    .min(1)
    .max(30),
  holdWeekends: z.boolean(),
  confirmEach: z.boolean(),
});

export const depositAddressBody = z.object({ network: z.string().min(1).max(40) });

export const prefsBody = z.object({ theme: z.enum(["light", "dark"]) });

export const tradeQuoteBody = z.object({ assetKey: z.string().min(1), amount: z.string() });

export const tradeBuyBody = tradeQuoteBody.extend({
  minQtyOut: decimalStr.optional(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

export const sellQuoteBody = z.object({ assetKey: z.string().min(1) });

export const sellBody = sellQuoteBody.extend({
  minReceive: decimalStr.optional(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

export const paymentBody = z.object({
  userId: z.string(),
  externalReference: z.string(),
  asset: z.string().default(env.TM_SETTLEMENT_ASSET),
  amount: decimalStr,
});

export function validate<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError(400, parsed.error.issues.map((i) => i.message).join("; "));
  return parsed.data;
}
