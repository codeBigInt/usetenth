export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
export const DEMO = process.env.NEXT_PUBLIC_APP_MODE !== "live";
export const WITHDRAW_TARGET = { asset: "USDC", network: "Base" };
export const SAMPLE_PAYMENT = "800.00";
export const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "https://t.me/usetenth_bot";
