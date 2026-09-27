import { env } from "../config/env";
import { Asset, InvestmentEvent, Order, Payment, User } from "../models";
import { cleanName } from "../utils/names";
import { usd } from "../utils/money";
import { paymentCardSpec, renderCard } from "./cards";
import { sendMessage, sendPhoto } from "./telegram";
import { webAppUrl } from "../config/web";

// "created" is a row written before submission (dry runs stay there), so it is not something bought.
const NOT_BOUGHT = ["created", "failed", "rejected_slippage", "canceled"];

/** Tells the user their payment was invested, once orders have actually gone out. */
export async function notifyInvested(eventId: string): Promise<void> {
  const event = await InvestmentEvent.findById(eventId);
  if (!event) return;
  const [payment, user, orders] = await Promise.all([
    Payment.findById(event.paymentId),
    User.findById(event.userId),
    Order.find({ investmentEventId: event._id, status: { $nin: NOT_BOUGHT } }),
  ]);
  if (!payment || !user?.telegramId || orders.length === 0) return;

  const assets = await Asset.find({ assetKey: { $in: orders.map((o) => o.asset) } }).select("assetKey name symbol");
  const names = new Map(assets.map((a) => [a.assetKey, cleanName(a.name ?? a.symbol)]));
  const spec = paymentCardSpec({
    amount: payment.amount,
    investmentAmount: event.investmentAmount,
    bought: orders.map((o) => ({ name: names.get(o.asset) ?? o.asset, amount: o.amount })),
  });

  const chatId = Number(user.telegramId);
  const url = webAppUrl("/portfolio");
  const button = url ? { text: "See my portfolio", url } : undefined;
  try {
    const caption = [
      "<b>Your payment came in</b>",
      "",
      `We kept your tenth and invested ${usd(event.investmentAmount)} across your mix. The rest, ${usd(spec.kind === "payment" ? spec.kept : "0")}, is yours to withdraw.`,
      "",
      "<blockquote>Open the app to see each order, its fee and the price you paid.</blockquote>",
    ].join("\n");
    await sendPhoto(chatId, renderCard(spec), caption, button);
  } catch (error) {
    console.error("Payment card failed, sending text instead", (error as Error).message);
    await sendMessage(chatId, `<b>Your payment came in</b>\n\nWe kept your tenth and invested ${usd(event.investmentAmount)}.`, button);
  }
}

export const shouldNotify = () => !env.DRY_RUN;
