# usetenth

Freelancers paid in stablecoins save a tenth of every payment without thinking about it. Set a rule once (5, 10 or 20 percent, and a mix of stocks) and each incoming payment automatically buys tokenized S&P 500 shares, through [True Markets](https://truemarkets.co).

It runs inside Telegram: a bot for commands and notifications, and a Mini App for setup, portfolio, buying and selling. Open [t.me/usetenth_bot](https://t.me/usetenth_bot) or scan the QR code on the landing page.

## How it works

1. **Payment arrives.** The API polls the True Markets account history and spots new deposits (no webhooks).
2. **The rule runs.** A tenth (or whatever percentage you chose) is split across your mix. Each leg must be at least $1.00, True Markets' minimum trade.
3. **Shares are bought.** Orders are quoted, signed with the account's API key and submitted through True Markets' DeFi API. Buys use the funded PYUSD balance directly.
4. **You are told.** The bot sends a payment-received card, and the portfolio shows cost basis and gain from an internal ledger, priced by live quotes.
5. **Selling** returns USDG (on Robinhood Chain) or USDC, not PYUSD.

## What is in this repo

| Folder | What it is |
| --- | --- |
| [api/](api/README.md) | Bun, Express 5 and MongoDB. Bot, trading, deposit watcher, ledger, cards. Full route and env reference is in its README |
| [web/](web/README.md) | Next.js 16 PWA. Landing page for browsers, Mini App screens inside Telegram |

The API also proxies the web app, so one public domain (an ngrok static domain in the demo) serves both.

## The demo, honestly

- **Real money.** One funded True Markets production account (about $50 in PYUSD) backs every user. There is no white-label account, so this is a demo, not a product ready for the public.
- **Invite only.** The owner is linked on their first `/start`. Judges are let in with `/start <code>` using one of the `INVITE_CODES`. Everyone else can look around but cannot trade.
- **Small caps.** `MAX_ORDER_USD` limits each order and `MAX_USER_SPEND_USD` each person's total spend. Each user can only sell what they bought themselves.
- **Not built yet:** withdrawals (the screen explains this), KYC and per-user wallets. These need a verified True Markets account, which the demo account is not.

## Try it

**Manual trades** (needs `TEST_BUY_ENABLED=true`): `/buy` opens a live quote and a two-step confirmation. `/sell` lists what you own. Selling something worth under $1.00 is refused, so buy a little more first.

**The automatic loop**, the core idea, can be tested two ways:

- **Without moving money:** save a rule in the app with one or two stocks, then run these in `api/`:

  ```
  bun run simulate-deposit 30          # prints what a $30 payment would buy, writes nothing
  bun run simulate-deposit 30 --run    # records it and runs the real pipeline
  ```

  At 10% a $30 payment invests $3, so use at most three stocks or the legs fall under $1.00. Set `DRY_RUN=false` to make the buys real; otherwise it only fetches quotes.
- **With a real deposit:** set `DRY_RUN=false`, restart the API, and send PYUSD to the deposit address shown by `/deposit`. The watcher checks every 30 seconds, invests, and the bot sends a card. Only deposits made after the server started are invested (override with `DEPOSIT_WATCH_SINCE`), so the original $50 is never re-invested.

## Running it

See [api/README.md](api/README.md) for env vars, the BotFather and ngrok setup and the route list, and [web/README.md](web/README.md) for the web app. In short: run MongoDB, start the API with `bun run dev` in `api/`, start the web app with `bun run dev` in `web/`, and open the bot.

Both have tests (`bun run test`) and typechecks (`bun run typecheck`).

## Safety habits in the money path

Orders are written before anything is signed. Every order has an idempotency key. A timeout or server error after submitting is treated as an unknown outcome and never retried. Buys and sells are refused if the price moves more than 1 percent from the quote. Amounts are decimal strings, never floats.
