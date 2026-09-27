// Read-only smoke test: lists tradeable assets and balances. Sends no orders.
import { trueMarketsService as tm } from "../src/integrations/truemarkets/truemarkets.service";

const assets = await tm.listAssets();
console.log("assets:", assets.error ?? JSON.stringify(assets.data)?.slice(0, 1500));
const balances = await tm.listBalances();
console.log("balances:", balances.error ?? "ok (fetched)");
