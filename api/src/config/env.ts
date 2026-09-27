import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  API_VERSION: z.coerce.number().default(1),
  MONGODB_URI: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  // Live buys from the UI are off unless explicitly enabled; DRY_RUN only governs the automatic pipeline.
  TEST_BUY_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  TEST_BUY_MAX_USD: z.string().default("2"),
  ADMIN_API_KEY: z.string().optional(),
  INVITE_CODES: z.string().optional(),
  DEPOSIT_DEFAULT_NETWORK: z.string().default("solana"),
  WEB_APP_URL: z.string().optional(),
  WEB_UPSTREAM_URL: z.string().default("http://localhost:3100"),
  NGROK_AUTHTOKEN: z.string().optional(),
  NGROK_TUNNEL_URL: z.string().optional(),
  // Read by @truemarkets/sdk itself (TM_ENV, TM_KEY_FILE); never read or log the key file.
  TM_ENV: z.string().default("prod"),
  TM_KEY_FILE: z.string().optional(),
  // Prod money is real: orders are only sent when DRY_RUN=false, and each is capped.
  // Spec: APP_MODE=demo enables caps; live lifts them. DRY_RUN additionally stops orders being sent.
  APP_MODE: z.enum(["demo", "live"]).default("demo"),
  DRY_RUN: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  TM_SETTLEMENT_ASSET: z.string().default("PYUSD"),
  MAX_ORDER_USD: z.string().default("2"),
  MAX_USER_SPEND_USD: z.string().default("2"),
  GLOBAL_FLOOR_USD: z.string().default("10"),
});

/** `KEY=` in a .env file is an empty string, which must mean "not set" (so defaults and `??` fallbacks apply). */
export const withoutEmpty = (source: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));

export const parseEnv = (source: Record<string, string | undefined>) => schema.parse(withoutEmpty(source));

export const env = parseEnv(process.env);
