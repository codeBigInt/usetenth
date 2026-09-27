import { escapeHtml as h } from "../utils/html";
import { usd } from "../utils/money";
import type { CardSpec, NamedAmount } from "./cards";
import { joinNames, networkName, type DepositNetwork } from "./deposit.pure";
import type { WebAppButton } from "./telegram";
import type { TelegramUser } from "./telegram-auth";

export interface TelegramUpdate {
  update_id: number;
  message?: { chat: { id: number }; from?: TelegramUser; text?: string };
}

export interface BotPortfolio {
  cash: string;
  value: string;
  invested: string;
  gain: string | null;
  holdings: NamedAmount[];
}

export interface BotRule {
  percent: number;
  mixName: string;
}

export interface BotDeposit {
  asset: string;
  defaultNetwork: string;
  networks: DepositNetwork[];
  canCreate?: boolean;
}

type Buttons = WebAppButton | WebAppButton[];

export interface BotDeps {
  send: (chatId: number, text: string, buttons?: Buttons) => Promise<void>;
  webUrl: (path: string) => string | null;
  demo: boolean;
  register: (from: TelegramUser) => Promise<void>;
  getPortfolio: () => Promise<BotPortfolio>;
  claimUpdate: (updateId: number) => Promise<boolean>;
  /** Optional: without these the bot answers in text only, or says the feature is off. */
  card?: (spec: CardSpec) => Buffer;
  sendPhoto?: (chatId: number, png: Buffer, caption?: string, buttons?: Buttons) => Promise<void>;
  getRule?: (from: TelegramUser) => Promise<BotRule | null>;
  /** Null when this user may not act on the demo account. */
  getDeposit?: (from: TelegramUser) => Promise<BotDeposit | null>;
  /** `/start <code>`: "owner" and "granted" mean the user now has demo access. */
  redeemInvite?: (from: TelegramUser, code: string) => Promise<"granted" | "invalid" | "owner">;
  /** The most a live test buy may spend, or null when test buys are off. */
  testBuyMaxUsd?: string | null;
  /** What this user may sell (their own holdings), or null when they have no demo access. */
  getSellable?: (from: TelegramUser) => Promise<{ assetKey: string; name: string; value: string | null }[] | null>;
}

/** The words after the command; `/start abc` is how Telegram delivers a deep link's payload. */
export function parseArgs(text?: string): string[] {
  return (text ?? "").trim().split(/\s+/).slice(1).filter(Boolean);
}

export function parseCommand(text?: string): string | null {
  const match = text?.trim().match(/^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

// ---- Copy. Plain language, no emoji; HTML for structure (bold, code, quotes). ----

export const copy = {
  welcome: () =>
    [
      "<b>Welcome to usetenth</b>",
      "",
      "Keep a tenth of every payment you receive. We invest it for you in tokenized stocks, so your money is working before you can spend it.",
      "",
      "<b>How it works</b>",
      "1. Set your tenth: 5%, 10% or 20% of each payment",
      "2. Get paid in stablecoins, as usual",
      "3. We invest your tenth automatically",
      "",
      "<blockquote>The rest of every payment stays yours, always.</blockquote>",
    ].join("\n"),

  tenth: (rule: BotRule | null) =>
    rule
      ? [
          "<b>Your tenth</b>",
          "",
          `${rule.percent}% of every payment you receive goes into your <b>${h(rule.mixName)}</b> mix. The other ${100 - rule.percent}% stays yours.`,
          "",
          "Open the app to change the percentage, switch mix or pick your own stocks.",
        ].join("\n")
      : [
          "<b>Your tenth</b>",
          "",
          "You have not set your tenth yet, so this shows the default: 10% of every payment into the Steady mix.",
          "",
          "Open the app to choose your own percentage and stocks.",
        ].join("\n"),

  portfolio: (p: BotPortfolio) => {
    if (p.holdings.length === 0) {
      return [
        "<b>Your portfolio</b>",
        "",
        `You have ${usd(p.cash)} ready to withdraw and nothing invested yet.`,
        "",
        "Your first payment will be split across your mix automatically. Open the app to check your mix or add funds.",
      ].join("\n");
    }
    const gain = p.gain === null ? "" : `, ${p.gain.startsWith("-") ? "down" : "up"} ${usd(p.gain.replace("-", ""))} since you started`;
    return [
      "<b>Your portfolio</b>",
      "",
      `Your investments are worth ${usd(p.value)} today${gain}. ${usd(p.cash)} is ready to withdraw.`,
      "",
      "<blockquote>Open the app to see every holding and what you paid for it.</blockquote>",
    ].join("\n");
  },

  help: () =>
    [
      "<b>What I can do</b>",
      "",
      "/portfolio  See what you own and what is ready to withdraw",
      "/tenth  Choose how much of each payment to invest, and in what",
      "/buy  Buy a small amount of a real stock",
      "/sell  Sell what you bought",
      "/deposit  How to add funds, with your deposit address",
      "/address  Just your deposit addresses",
      "/withdraw  Take money out",
      "",
      "<blockquote>Open the app from any message to do more without leaving Telegram.</blockquote>",
    ].join("\n"),

  withdraw: (demo: boolean) =>
    demo
      ? [
          "<b>Withdrawals are off in the demo</b>",
          "",
          "This demo runs on a real funded account, so nothing can leave it yet. In the live product you choose an amount and a wallet, and only money that was never invested is withdrawn unless you choose to sell.",
        ].join("\n")
      : ["<b>Withdraw</b>", "", "Choose an amount and where to send it. We withdraw money that was never invested, so nothing has to be sold."].join("\n"),

  depositOff: () =>
    "<b>Deposits are not switched on yet</b>\n\nDeposit addresses are not available in the demo right now. The demo account is already funded.",

  inviteOnly: () =>
    "<b>The demo is invite-only</b>\n\nDeposit details and test buys are for invited testers. Ask for an invite link and open it: it starts this bot with a code that unlocks them. You can still look around with /tenth, /portfolio and /help.",

  judge: (testBuyMaxUsd: string | null | undefined) =>
    [
      "<b>You have demo access</b>",
      "",
      "usetenth is running here on a shared, funded True Markets demo account, so you can try the real thing without setting anything up.",
      "",
      "<b>What to try</b>",
      "1. /tenth to choose your tenth and your stocks",
      "2. /portfolio to see the account",
      "3. /deposit to see how funding works",
      ...(testBuyMaxUsd ? [`4. Open the app and tap Try a buy to make a small real purchase, up to $${h(testBuyMaxUsd)}`] : []),
      "",
      "<blockquote>This is a demo account, not a user account. The live product gives every user their own account through a white-label integration with True Markets.</blockquote>",
    ].join("\n"),

  buy: (testBuyMaxUsd: string | null | undefined) =>
    testBuyMaxUsd
      ? `<b>Buy a stock</b>\n\nPick a stock and an amount, see a live quote, then confirm. Buys are small, up to $${h(testBuyMaxUsd)}, and use the shared demo account.`
      : "<b>Buying is switched off</b>\n\nLive buys are not enabled on this demo right now. You can still see quotes in the app.",

  sellNone: () =>
    "<b>Nothing to sell yet</b>\n\nYou can sell what you bought yourself. Buy a stock first, and it will show up here.",

  sell: (items: { name: string; value: string | null }[]) =>
    [
      "<b>Sell a holding</b>",
      "",
      "Choose what to sell. You will see a live quote and confirm before anything happens.",
      "",
      ...items.map((i) => `${h(i.name)}${i.value ? `, worth about ${usd(i.value)}` : ""}`),
      "",
      "<blockquote>True Markets needs each sale to be at least $1.00, so very small holdings cannot be sold on their own yet.</blockquote>",
    ].join("\n"),

  badInvite: () =>
    "<b>That invite code is not valid</b>\n\nYou can still look around with /tenth, /portfolio and /help. Ask for a fresh invite link to unlock deposits and test buys.",

  deposit: (d: BotDeposit) => {
    const net = d.networks.find((n) => n.network === d.defaultNetwork && n.address);
    if (!net?.address) return copy.depositOff();
    const name = networkName(net.network);
    const target = net.source === "wallet" ? "your wallet address" : "this address";
    const also = net.compatible.length ? `\n\nThis address also accepts ${h(d.asset)} sent on ${joinNames(net.compatible)}.` : "";
    return [
      "<b>Add funds</b>",
      "",
      `Send <b>${h(d.asset)}</b> to ${target} on the <b>${h(name)}</b> network:`,
      "",
      `<code>${h(net.address)}</code>`,
      "",
      `<blockquote>Only send ${h(d.asset)} on ${h(name)}. Any other asset or network can be lost for good.</blockquote>`,
      "",
      `When your payment lands we keep your tenth and invest it, and you will get a message here.${also}`,
      "",
      d.canCreate === false
        ? "Other networks and bank transfers open up once your account is verified. Open the app to see what is available."
        : "Prefer another network? Open the app to see every option, or to add funds from a bank.",
    ].join("\n");
  },

  addresses: (d: BotDeposit) => {
    const made = d.networks.filter((n) => n.address);
    if (made.length === 0) return copy.depositOff();
    return [
      "<b>Your deposit addresses</b>",
      "",
      ...made.flatMap((n) => [
        `<b>${h(networkName(n.network))}</b>, ${h(d.asset)}${n.source === "wallet" ? ", your wallet" : ""}${n.compatible.length ? `, also ${joinNames(n.compatible)}` : ""}`,
        `<code>${h(n.address!)}</code>`,
        "",
      ]),
      "Always check the network before you send.",
    ].join("\n");
  },
};

export async function handleUpdate(update: TelegramUpdate, deps: BotDeps): Promise<void> {
  const message = update.message;
  if (!message) return;
  if (!(await deps.claimUpdate(update.update_id))) return;

  const chatId = message.chat.id;
  const from = message.from;
  const command = parseCommand(message.text);
  if (!command) return;

  const open = (path: string, text: string): WebAppButton[] => {
    const url = deps.webUrl(path);
    return url ? [{ text, url }] : [];
  };

  // A card when we can draw one; otherwise the same words as text.
  const reply = async (o: { card?: CardSpec; text: string; buttons?: WebAppButton[] }) => {
    const buttons = o.buttons?.length ? o.buttons : undefined;
    if (o.card && deps.card && deps.sendPhoto) {
      try {
        await deps.sendPhoto(chatId, deps.card(o.card), o.text, buttons);
        return;
      } catch (error) {
        console.error("Card failed, sending text instead", { kind: o.card.kind, message: (error as Error).message });
      }
    }
    await deps.send(chatId, o.text, buttons);
  };

  try {
    switch (command) {
      case "start": {
        if (from) await deps.register(from);
        // Redeem before replying: a failed send must never lose an invite.
        const code = parseArgs(message.text)[0];
        const outcome = code && from && deps.redeemInvite ? await deps.redeemInvite(from, code) : null;
        await reply({ card: { kind: "welcome" }, text: copy.welcome(), buttons: open("/", "Open usetenth") });
        if (outcome === "invalid") await deps.send(chatId, copy.badInvite());
        else if (outcome) await deps.send(chatId, copy.judge(deps.testBuyMaxUsd), [...open("/portfolio", "Open my portfolio"), ...(deps.testBuyMaxUsd ? open("/buy", "Try a buy") : [])]);
        return;
      }
      case "help":
        await deps.send(chatId, copy.help());
        return;
      case "tenth": {
        const rule = from && deps.getRule ? await deps.getRule(from).catch(() => null) : null;
        await reply({
          card: { kind: "tenth", percent: rule?.percent ?? 10, mixName: rule?.mixName ?? "Steady" },
          text: copy.tenth(rule),
          buttons: open("/tenth", "Open my tenth"),
        });
        return;
      }
      case "portfolio": {
        const p = await deps.getPortfolio();
        await reply({
          card: { kind: "portfolio", worth: p.value, gain: p.gain, invested: p.invested, cash: p.cash, holdings: p.holdings },
          text: copy.portfolio(p),
          buttons: open("/portfolio", "Open my portfolio"),
        });
        return;
      }
      case "deposit":
      case "address": {
        if (!from || !deps.getDeposit) {
          await deps.send(chatId, copy.depositOff(), open("/add-funds", "How funding works"));
          return;
        }
        const deposit = await deps.getDeposit(from);
        if (!deposit) {
          await deps.send(chatId, copy.inviteOnly());
          return;
        }
        await deps.send(chatId, command === "deposit" ? copy.deposit(deposit) : copy.addresses(deposit), [
          ...open("/add-funds", "Use a different network"),
          ...(command === "deposit" ? open("/add-funds?method=bank", "Add funds from a bank") : []),
        ]);
        return;
      }
      case "buy": {
        if (from && deps.getSellable && (await deps.getSellable(from)) === null) {
          await deps.send(chatId, copy.inviteOnly());
          return;
        }
        await deps.send(chatId, copy.buy(deps.testBuyMaxUsd), open("/buy", "Buy a stock"));
        return;
      }
      case "sell": {
        const items = from && deps.getSellable ? await deps.getSellable(from) : null;
        if (items === null) {
          await deps.send(chatId, copy.inviteOnly());
          return;
        }
        if (items.length === 0) {
          await deps.send(chatId, copy.sellNone(), open("/buy", "Buy a stock"));
          return;
        }
        await deps.send(
          chatId,
          copy.sell(items),
          items.flatMap((i) => open(`/sell?asset=${encodeURIComponent(i.assetKey)}`, `Sell ${i.name}`)),
        );
        return;
      }
      case "withdraw":
        await deps.send(chatId, copy.withdraw(deps.demo), open("/withdraw", "Open withdraw"));
        return;
      default:
        await deps.send(chatId, "I do not know that command. Send /help to see what I can do.");
    }
  } catch (error) {
    console.error("Telegram command failed", { command, message: (error as Error).message });
    await deps.send(chatId, "Something went wrong. Please try again in a moment.").catch(() => undefined);
  }
}
