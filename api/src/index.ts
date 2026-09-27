import { createApp } from "./app";
import "./config/baskets";
import { env } from "./config/env";
import { trueMarketsService } from "./integrations/truemarkets/truemarkets.service";
import { AssetSyncJob } from "./jobs/asset-sync.job";
import { Account, Order, Payment } from "./models";
import { startTunnel, telegramWebhookUrl } from "./services/tunnel";
import { DepositPoller, historyToIncoming, insertDeposit } from "./services/deposit-watcher";
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

  // Demo: one shared TM account, so deposits go to the single linked user.
  const depositPoller = new DepositPoller(
    {
      fetchIncoming: async () => {
        const userIds = await Account.find().distinct("userId");
        if (userIds.length !== 1) {
          console.warn(`Deposit watcher: expected 1 linked account, found ${userIds.length}; skipping`);
          return [];
        }
        const { data, error } = await trueMarketsService.listHistory();
        if (error) throw new Error("history fetch failed");
        return historyToIncoming(data?.items ?? [], String(userIds[0]));
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
