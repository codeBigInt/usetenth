/** "Apple (Coinbase Tokenized Stock)" and "Applied Materials • Robinhood Token" both read as the company. */
export const cleanName = (n: string) =>
  n.replace(/\s*[•·]\s*Robinhood Token$/i, "").replace(/\s*\(Coinbase Tokenized Stock\)$/i, "");
