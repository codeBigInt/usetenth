const set = (v: string | undefined) => (v ? v : undefined);

// NEXT_PUBLIC_* values are inlined when the app is built, so rebuild after changing them.
export const API_URL = set(process.env.NEXT_PUBLIC_API_URL) ?? "/api/v1";
export const DEMO = process.env.NEXT_PUBLIC_APP_MODE !== "live";
export const BOT_URL = set(process.env.NEXT_PUBLIC_BOT_URL) ?? "https://t.me/usetenth_bot";
export const WITHDRAW_TARGET = {
  asset: set(process.env.NEXT_PUBLIC_WITHDRAW_ASSET) ?? "USDC",
  network: set(process.env.NEXT_PUBLIC_WITHDRAW_NETWORK) ?? "Base",
};
export const SAMPLE_PAYMENT = set(process.env.NEXT_PUBLIC_SAMPLE_PAYMENT) ?? "800.00";
