export interface MixStock {
  assetKey?: string;
  ticker: string;
  name: string;
}

export interface Mix {
  id: string;
  name: string;
  blurb: string;
  stocks: MixStock[];
}

export const MIXES: Mix[] = [
  {
    id: "steady",
    name: "Steady",
    blurb: "Spread across the largest companies.",
    stocks: [
      { ticker: "AAPL", name: "Apple" },
      { ticker: "NVDA", name: "Nvidia" },
      { ticker: "MSFT", name: "Microsoft" },
      { ticker: "AMZN", name: "Amazon" },
      { ticker: "GOOGL", name: "Alphabet" },
      { ticker: "META", name: "Meta" },
      { ticker: "JPM", name: "JPMorgan" },
      { ticker: "V", name: "Visa" },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    blurb: "Fewer names, bigger swings.",
    stocks: [
      { ticker: "NVDA", name: "Nvidia" },
      { ticker: "TSLA", name: "Tesla" },
      { ticker: "AMD", name: "AMD" },
      { ticker: "PLTR", name: "Palantir" },
      { ticker: "NFLX", name: "Netflix" },
    ],
  },
  {
    id: "tech",
    name: "Tech-heavy",
    blurb: "Software and chipmakers only.",
    stocks: [
      { ticker: "MSFT", name: "Microsoft" },
      { ticker: "NVDA", name: "Nvidia" },
      { ticker: "AMD", name: "AMD" },
      { ticker: "AVGO", name: "Broadcom" },
      { ticker: "CRM", name: "Salesforce" },
      { ticker: "ORCL", name: "Oracle" },
    ],
  },
];

export function summarize(stocks: { name: string }[]): string {
  if (stocks.length === 0) return "No stocks picked yet";
  if (stocks.length <= 2) return stocks.map((s) => s.name).join(" and ");
  return `${stocks[0]!.name}, ${stocks[1]!.name} and ${stocks.length - 2} more`;
}

export const cleanName = (n: string) =>
  n.replace(/\s*[•·]\s*Robinhood Token$/i, "").replace(/\s*\(Coinbase Tokenized Stock\)$/i, "");
