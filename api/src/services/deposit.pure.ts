const NAMES: Record<string, string> = {
  solana: "Solana",
  ethereum: "Ethereum",
  base: "Base",
  xlayer: "X Layer",
  ink: "Ink",
  robinhood: "Robinhood Chain",
  polygon_pos: "Polygon",
  arbitrum_one: "Arbitrum",
  bitcoin: "Bitcoin",
};

export const networkName = (id: string) => NAMES[id] ?? id.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const joinNames = (ids: string[]) => {
  const names = ids.map(networkName);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

/** "deposit" is a True Markets deposit address; "wallet" is the account's own wallet, which also receives transfers. */
export interface DepositNetwork {
  network: string;
  compatible: string[];
  address: string | null;
  source: "deposit" | "wallet" | null;
}

export interface RawAddress {
  network: string;
  address: string;
  compatible_networks?: string[];
}

/** An 0x address is an EVM wallet; anything else on this platform is Solana. */
export const walletNetwork = (address: string) => (/^0x/i.test(address) ? "ethereum" : "solana");

/**
 * Supported networks for the asset, each with an address if we have one: a real deposit address first, else the
 * account's wallet on its own network. Only networks the asset accepts are ever listed.
 */
export function mergeNetworks(
  supported: { network: string; compatible: string[] }[],
  addresses: RawAddress[],
  wallet: string | null = null,
): DepositNetwork[] {
  const byNetwork = new Map(addresses.map((a) => [a.network, a]));
  return supported.map((n) => {
    const deposit = byNetwork.get(n.network);
    if (deposit) return { network: n.network, compatible: n.compatible, address: deposit.address, source: "deposit" as const };
    if (wallet && walletNetwork(wallet) === n.network) return { network: n.network, compatible: n.compatible, address: wallet, source: "wallet" as const };
    return { network: n.network, compatible: n.compatible, address: null, source: null };
  });
}
