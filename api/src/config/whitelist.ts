import { SP500_TICKERS } from "./sp500";

export type AssetKind = "equity" | "crypto" | "stable";
export type AssetVenue = "defi" | "cefi";

export interface WhitelistEntry {
  assetKey: string;
  symbol: string;
  displayName: string;
  kind: AssetKind;
  venue: AssetVenue;
  enabled: boolean;
}

// Hand-reviewed; never auto-populated from the catalog sync.
export const MANUAL_WHITELIST: WhitelistEntry[] = [
  { assetKey: "cefi:BTC", symbol: "BTC", displayName: "Bitcoin", kind: "crypto", venue: "cefi", enabled: true },
  { assetKey: "cefi:ETH", symbol: "ETH", displayName: "Ethereum", kind: "crypto", venue: "cefi", enabled: true },
];

export const whitelistByKey = new Map(MANUAL_WHITELIST.map((w) => [w.assetKey, w]));

// Stocks are eligible if tradeable and an S&P 500 member; this blocks individual tickers.
export const DISABLED_STOCK_TICKERS = new Set<string>([]);

export function isStockTickerEligible(ticker: string): boolean {
  return SP500_TICKERS.has(ticker) && !DISABLED_STOCK_TICKERS.has(ticker);
}
