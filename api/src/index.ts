import { createApp } from "./app";
import "./config/baskets";
import { env } from "./config/env";
import { trueMarketsService } from "./integrations/truemarkets/truemarkets.service";
import { AssetSyncJob } from "./jobs/asset-sync.job";
import { Account, Order, Payment } from "./models";
import { startTunnel, telegramWebhookUrl } from "./services/tunnel";
import { DepositPoller, insertDeposit } from "./services/deposit-watcher";
import { pollBalanceOnce } from "./services/balance-watcher";
import type { BalanceRow } from "./services/portfolio.pure";
import { processPayment } from "./services/investment.service";
import { notifyInvested, shouldNotify } from "./services/notify";
import { OrderPoller } from "./jobs/order-status.worker";
import { Database } from "./services/db";

(async function main() {
  const database = new Database(env.MONGODB_URI);

  await database.connect();
  await Order.syncIndexes(); // the unique index is now partial (manual trades have no investment event)

  const app = createApp({ isReady: () => database.isConnected() });
  const server = app.listen(env.PORT, () => {
    console.log(
      `Server listening at: http://localhost:${env.PORT}/api/v${env.API_VERSION} (TM_ENV=${env.TM_ENV}, APP_MODE=${env.APP_MODE}, DRY_RUN=${env.DRY_RUN})`,
    );
  });

  server.on("upgrade", app.locals.webProxy.upgrade);

  const tunnel = await startTunnel(env.PORT).catch((error) => {
    console.error("ngrok tunnel failed to start", error);
    return null;
  });
  if (tunnel) console.log(`Telegram webhook URL: ${telegramWebhookUrl()}`);

  const orderPoller = new OrderPoller();
  orderPoller.start();

  const assetSyncJob = new AssetSyncJob();
  assetSyncJob.start();

  // True Markets doesn't surface a raw external transfer landing on this (unverified) account's
  // wallet through its history or transfers endpoints — only listBalances reflects it. So the
  // watcher tracks the settlement-asset balance itself: a rise since the last poll is a deposit,
  // since nothing else in this account's flow raises it (buys spend it, sells pay out elsewhere).
  const depositPoller = new DepositPoller(
    {
      fetchIncoming: async () => {
        const accounts = await Account.find().distinct("userId");
        if (accounts.length !== 1) {
          console.warn(`Deposit watcher: expected 1 linked account, found ${accounts.length}; skipping`);
          return [];
        }
        const userId = String(accounts[0]);

        const { data, error } = await trueMarketsService.listBalances();
        if (error) throw new Error("balance fetch failed");
        const balances = (data?.data ?? []) as BalanceRow[];
        const settlement = balances.find((b) => b.symbol === env.TM_SETTLEMENT_ASSET);
        if (!settlement?.available) throw new Error(`no ${env.TM_SETTLEMENT_ASSET} balance in listBalances`);

        const result = await pollBalanceOnce({
          fetchBalance: async () => settlement.available!,
          getWatermark: async () => (await Account.findOne({ userId }).select("lastSettlementBalance"))?.lastSettlementBalance ?? null,
          setWatermark: async (value) => {
            await Account.updateOne({ userId }, { lastSettlementBalance: value });
          },
        });
        if (!result) return [];
        return [{ transferId: `balance-${Date.now()}`, userId, amount: result.amount, asset: env.TM_SETTLEMENT_ASSET }];
      },
      insertDeposit,
    },
    async (d) => {
      const payment = await Payment.findOneAndUpdate(
        { externalReference: d.transferId },
        { $setOnInsert: { userId: d.userId, externalReference: d.transferId, asset: d.asset, amount: d.amount, status: "confirmed" } },
        { upsert: true, new: true },
      );
      const event = await processPayment(payment._id.toString());
      if (event && shouldNotify()) await notifyInvested(event._id.toString()).catch((e) => console.error("Invested notice failed", (e as Error).message));
    },
  );
  depositPoller.start();
  console.log("Deposit watcher: watching the settlement-asset balance for deposits");

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info("Shutting down usetenth API");
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await tunnel?.close();
    await orderPoller.stop();
    await assetSyncJob.stop();
    await depositPoller.stop();
    await database.disconnect();
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      shutdown().then(
        () => process.exit(0),
        (error) => {
          console.error("Shutdown failed", error);
          process.exit(1);
        },
      );
    });
  }
})().catch((error) => {
  console.error("Fatal startup error", error);
  process.exit(1);
});
