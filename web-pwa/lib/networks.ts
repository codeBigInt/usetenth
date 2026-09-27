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

/** "bank_name" and "accountNumber" both read as words. */
export const labelOf = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
