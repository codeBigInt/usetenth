// Exercises the automatic pipeline (deposit -> rule -> orders -> notification) without moving any money in.
// Usage: bun run simulate-deposit <amount>          shows the plan, writes nothing
//        bun run simulate-deposit <amount> --run    records the payment and runs it (real buys when DRY_RUN=false)
import { env } from "../src/config/env";
import { Account, Payment, Rule } from "../src/models";
import { Database } from "../src/services/db";
import { planOrders } from "../src/services/investment.pure";
import { processPayment } from "../src/services/investment.service";
import { notifyInvested, shouldNotify } from "../src/services/notify";
import { dec, percentOf } from "../src/utils/money";

const amount = process.argv[2];
const run = process.argv.includes("--run");
if (!amount || dec(amount).lte(0)) {
  console.error("Usage: bun run simulate-deposit <amount> [--run]");
  process.exit(1);
}

const db = new Database(env.MONGODB_URI);
await db.connect();
try {
  const account = await Account.findOne({ externalAccountId: "demo" });
  if (!account) throw new Error("No linked owner yet. Send /start to the bot first.");
  const rule = await Rule.findOne({ userId: account.userId, enabled: true, type: "PAYMENT_PERCENTAGE" });
  if (!rule?.percentage || rule.allocations.length === 0) throw new Error("The owner has no active rule. Set a tenth and a mix in the app first.");

  const tenth = percentOf(amount, rule.percentage);
  const { orders, skipped } = planOrders(tenth, rule.allocations);
  console.log(`Payment ${amount} at ${rule.percentage}% invests ${tenth}.`);
  for (const o of orders) console.log(`  buy  ${o.amount}  ${o.asset}`);
  for (const o of skipped) console.log(`  skip ${o.amount}  ${o.asset} (under the $1.00 minimum)`);
  console.log(`Mode: DRY_RUN=${env.DRY_RUN}, MAX_ORDER_USD=${env.MAX_ORDER_USD}, MAX_USER_SPEND_USD=${env.MAX_USER_SPEND_USD}`);
  if (orders.length === 0) console.log("Nothing would be bought: every leg is under the minimum. Use a bigger amount or fewer stocks.");
  if (!run) process.exit(0);

  const payment = await Payment.create({
    userId: account.userId,
    externalReference: `sim-${Date.now()}`,
    asset: env.TM_SETTLEMENT_ASSET,
    amount,
    status: "confirmed",
  });
  const event = await processPayment(payment._id.toString());
  console.log(event ? `Investment ${event._id}: ${event.status}` : "Nothing was invested.");
  if (event && shouldNotify()) await notifyInvested(event._id.toString());
} finally {
  await db.disconnect();
}
