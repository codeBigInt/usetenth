import { dec } from "../utils/money";
import { whitelistByKey } from "./whitelist";

export interface BasketWeight {
  assetKey: string;
  weight: string;
}

export interface Basket {
  name: string;
  description: string;
  weights: BasketWeight[];
}

export const BASKETS: Basket[] = [
  {
    name: "steady",
    description: "An even split between Bitcoin and Ethereum.",
    weights: [
      { assetKey: "cefi:BTC", weight: "0.5" },
      { assetKey: "cefi:ETH", weight: "0.5" },
    ],
  },
];

function assertValid(b: Basket): void {
  const sum = b.weights.reduce((a, w) => a.plus(w.weight), dec(0));
  if (!sum.equals(1)) throw new Error(`basket "${b.name}": weights sum to ${sum.toFixed()}, not 1`);
  for (const w of b.weights) {
    const entry = whitelistByKey.get(w.assetKey);
    if (!entry) throw new Error(`basket "${b.name}": ${w.assetKey} is not whitelisted`);
    if (!entry.enabled) throw new Error(`basket "${b.name}": ${w.assetKey} is disabled`);
  }
}

// Validated at import so a bad basket fails at boot, not mid-trade.
for (const b of BASKETS) assertValid(b);

const basketsByName = new Map(BASKETS.map((b) => [b.name, b]));

export function basket(name: string): Basket {
  const b = basketsByName.get(name);
  if (!b) throw new Error(`unknown basket "${name}"`);
  return b;
}
