import { trueMarkets } from "./client";

/** The DeFi wallet that holds the account's balances. The SDK types call this `wallets[]`; the live API returns `walletAddress`. */
export async function getWalletAddress(): Promise<string | null> {
  const { data } = await trueMarkets.defi.getProfile({});
  const profile = data as { walletAddress?: string; wallets?: { address?: string }[] } | undefined;
  return profile?.walletAddress ?? profile?.wallets?.[0]?.address ?? null;
}
