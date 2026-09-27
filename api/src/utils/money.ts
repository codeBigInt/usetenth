import Decimal from "decimal.js";

export const dec = (v: Decimal.Value) => new Decimal(v);

/** amount * percentage / 100, as a plain decimal string, always with 2 decimal places. */
export function percentOf(amount: string, percentage: string): string {
  return dec(amount).mul(percentage).div(100).toFixed(2, Decimal.ROUND_DOWN);
}

export function sumsTo100(percentages: string[]): boolean {
  return percentages.reduce((a, p) => a.plus(p), dec(0)).equals(100);
}

export function usd(value: string): string {
  const d = dec(value);
  const [whole = "0", frac = "00"] = d.abs().toFixed(2, Decimal.ROUND_DOWN).split(".");
  return `${d.isNegative() ? "-" : ""}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
}
