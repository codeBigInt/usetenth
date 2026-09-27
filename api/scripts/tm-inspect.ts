import { trueMarketsService as tm } from "../src/integrations/truemarkets/truemarkets.service";

const a: any = (await tm.listAssets()).data;
const list: any[] = a?.data ?? a;
const tally: Record<string, number> = {};
for (const x of list) {
  const k = `${x.asset_class}/${x.venue}/${x.type}`;
  tally[k] = (tally[k] ?? 0) + 1;
}
console.log("total", list.length, "pagination", JSON.stringify(a?.pagination));
console.log(tally);
console.log("stables:", list.filter((x) => x.stable).map((x) => `${x.symbol}@${x.chain}`).join(" "));
console.log("equities:", list.filter((x) => /equity|stock/i.test(x.asset_class)).slice(0, 25).map((x) => `${x.symbol}:${x.chain}:${x.venue}:${x.tradeable}`).join(" "));
const b: any = (await tm.listBalances()).data;
console.log("balances:", JSON.stringify(b)?.slice(0, 1200));
process.exit(0);
