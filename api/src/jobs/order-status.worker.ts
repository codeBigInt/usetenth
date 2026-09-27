import { trueMarketsService } from "../integrations/truemarkets/truemarkets.service";
import { Order, OrderEvent } from "../models";
import { reconcileDefiOrders } from "../services/trade.service";

/** Polls open orders and records status changes. */
export async function pollOrders() {
  const open = await Order.find({
    providerOrderId: { $exists: true },
    status: { $in: ["pending", "active", "cancel_pending"] },
    venue: { $ne: "defi" }, // DeFi orders are unknown to the gateway; they settle from account history
  });
  for (const order of open) {
    const status = await trueMarketsService.getOrderStatus(order.providerOrderId!);
    if (status && status !== order.status) {
      order.status = status;
      await order.save();
      await OrderEvent.create({ orderId: order._id, status });
      // TODO: notify user via Telegram on complete/failed
    }
  }
  await reconcileDefiOrders().catch((e) => console.error("DeFi reconcile failed", (e as Error).message));
}

export class OrderPoller {
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;

  constructor(private readonly intervalMs = 10_000) {}

  start() {
    this.timer = setInterval(() => {
      if (this.inFlight) return; // never overlap runs
      this.inFlight = pollOrders()
        .catch((e) => console.error("Order poll failed", e))
        .finally(() => (this.inFlight = undefined));
    }, this.intervalMs);
  }

  /** Stops scheduling and waits for a running poll to finish. */
  async stop() {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }
}
