import { dec } from "../utils/money";

/** Pure: would `amount` push a user's spend past the cap? */
export function withinSpendCap(spent: string, amount: string, cap: string): boolean {
  return dec(spent).plus(amount).lte(cap);
}

/** Pure: trading stops once the account balance falls below the floor. */
export function aboveFloor(balance: string, floor: string): boolean {
  return dec(balance).gte(floor);
}
