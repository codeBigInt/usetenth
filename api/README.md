# usetenth API

Backend for **usetenth**, a Telegram bot and web app for freelancers paid in stablecoins. A rule (default 10%) diverts a slice of each incoming payment into tokenized US stocks (S&P 500 constituents) and BTC/ETH through [True Markets](https://truemarkets.co), with withdrawals back out in crypto or through the True Markets off-ramp.

Built for the True Markets hackathon. Runs on Bun, Express 5, MongoDB (Mongoose) and the `@truemarkets/sdk`.

## How it works

```text
deposit detected ──► Payment ──► rule engine ──► order intents ──► True Markets ──► fills ──► ledger
 (30s poller)                    (10%, min batch,               (quote, create,        (positions,
                                  weekend hold,                  execute, poll)         cost basis)
                                  rebalance)
```

1. The deposit poller reads True Markets account history every 30 seconds and records settled `DEPOSIT`/`RECEIVE` rows. A unique index on the transfer id means a deposit is processed once, however often it is seen.
2. The deposit becomes a `Payment`, and `processPayment` applies the user's `Rule` (percentage, minimum amount, allocations).
3. Orders are quoted and placed through the True Markets service. Every order has an idempotency key and is written before the outbound call.
4. The order poller tracks status; fills update the append-only ledger and a derived positions cache.

Money is always a decimal string (`decimal.js`), never a float.

## Architecture

```text
src/
  index.ts            startup, background jobs, graceful shutdown
  app.ts              createApp(): middleware + one router per resource
  routes/             one Router per resource (health, users, rules, assets, payments, telegram)
  controllers/        request handlers
  middleware/         request id, Telegram secret check, 404 + error handler
  schemas/            zod request bodies and validate()
  config/             env (zod), sp500, whitelist, baskets
  integrations/
    truemarkets/      the only code that imports @truemarkets/sdk
  services/           assets, rule-engine (pure), investment, ledger, deposit-watcher, guards, db
  jobs/               order-status worker, asset-sync job
  models/             Mongoose models
  utils/              response helpers, money helpers, types
tests/                Vitest tests mirroring src/
scripts/              read-only True Markets inspection scripts
```

### Key modules

- **Assets and whitelist** ([assets.service.ts](src/services/assets.service.ts), [whitelist.ts](src/config/whitelist.ts)): crypto is a hand-reviewed whitelist (BTC, ETH). Stocks are eligible automatically if they are tradeable and an S&P 500 member ([sp500.ts](src/config/sp500.ts), snapshot 2026-09-24). `DISABLED_STOCK_TICKERS` blocks individual tickers. Assets are keyed by chain and contract address, never by symbol.
- **Baskets** ([baskets.ts](src/config/baskets.ts)): named weight sets validated at import, so a basket that does not sum to exactly 1 or contains a non-whitelisted asset stops the server from starting.
- **Rule engine** ([rule-engine.ts](src/services/rule-engine.ts)): pure `plan()` function. Handles percentage, minimum batch, weekend hold, cash-flow-only rebalancing toward underweight assets, and largest-remainder splitting so allocations always re-add to the cent. Not yet called by `investment.service.ts`, which still uses per-rule allocations.
- **Deposit watcher** ([deposit-watcher.ts](src/services/deposit-watcher.ts)): insert first, emit second. In demo mode deposits are attributed to the single linked user.
- **Guards** ([guards.ts](src/services/guards.ts)): in `APP_MODE=demo`, per-order and per-user spend caps are enforced before any order.

## Routes

Base path: `/api/v1`. Responses use `{ message, data, status }`. Every response carries an `x-request-id` header.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | Welcome |
| GET | `/health` | Liveness, plus `mode` and `dryRun` |
| GET | `/readiness` | 200 when MongoDB is connected, otherwise 503 |
| POST | `/users` | Admin only (`x-admin-key`). Upsert a user by `telegramId` (`telegramUsername` optional) |
| POST | `/rules` | Admin only. Create a rule: `userId`, `percentage` (default 10), `minimumAmount`, `allocations[{ asset, percentage }]`. Assets must come from `/assets/investable` |
| GET | `/assets/investable` | Assets a user may pick: whitelisted crypto plus eligible S&P 500 stocks that are currently tradeable |
| GET | `/portfolio` | The demo account's live state: settlement-asset cash, holdings priced by quote, cost basis from the ledger, and gain (null when a price or cost is missing) |
| POST | `/payments` | Admin only. Record a trusted payment (`userId`, `externalReference`, `amount`, `asset`) and run the investment engine. Idempotent on `externalReference` |
| GET | `/me` | Who is asking: the Telegram user verified from `Authorization: tma <initData>`, or `null` for the public demo. A forged or expired `initData` gets 401 |
| GET | `/deposits` | Deposit options for the settlement asset: each accepted network with its address and where it came from, whether this account may create more (`canCreate`), and any bank-transfer details. Demo owner only |
| POST | `/deposits/addresses` | Address for a network (`{ network }`). Refuses networks the asset does not accept; creates a True Markets address only for a verified account, otherwise 409 with the reason. Demo owner only |
| POST | `/deposits/wire-instructions` | Sets up bank-transfer details (verified account only). Demo owner only |
| POST | `/trades/quote` | Live DeFi quote for a tokenized stock (`{ assetKey, amount }`): tokens out, price, fee and any issues such as insufficient balance. Demo access only |
| POST | `/trades/buy` | A real buy (`{ assetKey, amount, minQtyOut, idempotencyKey }`). Refused unless `TEST_BUY_ENABLED=true`; see below. Demo access only |
| POST | `/trades/sell/quote` | Live quote for selling everything the caller may sell of one stock (`{ assetKey }`): tokens, proceeds, fee, and the asset the proceeds arrive in |
| POST | `/trades/sell` | A real sale (`{ assetKey, minReceive, idempotencyKey }`), same guards as a buy. Demo access only |
| GET, PUT | `/me/rule` | Your saved rule, for the verified Telegram user (401 otherwise). `PUT` takes `percent` (1 to 50), `mixId`, `picks` (tickers or asset keys), `holdWeekends`, `confirmEach`; resolves picks to assets that can be bought now (Coinbase's listing preferred), splits them equally to exactly 100.00, and returns any `skipped` picks. Nothing buyable is a 400 |
| POST | `/telegram/webhook` | Telegram updates. Requires the `x-telegram-bot-api-secret-token` header, otherwise 403. Acknowledged at once, then handled |

## Environment variables

Copy `.env.example` to `.env`.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MONGODB_URI` | yes | | MongoDB connection string |
| `TM_ENV` | no | `prod` | True Markets environment read by the SDK |
| `TM_KEY_FILE` | yes | | Path to the True Markets API key **JSON file** (not a directory). Never commit it |
| `TM_SETTLEMENT_ASSET` | no | `PYUSD` | Asset used to pay for orders |
| `APP_MODE` | no | `demo` | `demo` enables spend caps; `live` lifts them |
| `DRY_RUN` | no | `true` | When true, orders are quoted but never sent |
| `MAX_ORDER_USD` | no | `2` | Per-order cap, enforced in every mode |
| `MAX_USER_SPEND_USD` | no | `2` | Per-user total spend cap in demo mode |
| `GLOBAL_FLOOR_USD` | no | `10` | Trading floor (not yet enforced) |
| `TELEGRAM_BOT_TOKEN` | for the bot | | Token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | for the bot | | Shared secret Telegram sends with every webhook call |
| `ADMIN_API_KEY` | for admin routes | | Secret for `POST /users`, `/rules` and `/payments`, sent as `x-admin-key`. Unset means those routes are closed (503) |
| `INVITE_CODES` | for judges | | Comma-separated codes that unlock demo access through `/start <code>` |
| `TEST_BUY_ENABLED` | no | `false` | Allows a real buy or sale from the web app. Off means it only shows quotes. Independent of `DRY_RUN` |
| `DEPOSIT_WATCH_SINCE` | no | server start | ISO date. Deposits before it are history and are never invested. Set it earlier to pick up a deposit made while the server was down |
| `TEST_BUY_MAX_USD` | no | `2` | Most a single test buy may spend (minimum order is $1) |
| `DEPOSIT_DEFAULT_NETWORK` | no | `solana` | Network `/deposit` shows first |
| `NGROK_AUTHTOKEN` | for the tunnel | | ngrok auth token. With `NGROK_TUNNEL_URL` set, the server opens the tunnel itself on startup |
| `NGROK_TUNNEL_URL` | for the tunnel | | Your reserved ngrok domain (with or without `https://`) |
| `WEB_UPSTREAM_URL` | no | `http://localhost:3100` | Where the web app runs. The API proxies every non-`/api/v1` path to it, so one public domain serves both |
| `WEB_APP_URL` | no | the ngrok domain | Public URL the bot's buttons open, if it differs from the ngrok domain |
| `PORT` | no | `3000` | HTTP port |
| `API_VERSION` | no | `1` | Route prefix (`/api/v1`) |
| `NODE_ENV` | no | `development` | |

`TRUE_MARKET_BASE_URL` and `TRUE_MARKEY_UAT_BASE_URL` in `.env.example` are not read by the code; the SDK selects the host from `TM_ENV`.

This project runs against **production** True Markets with real funds. Keep `DRY_RUN=true` until you deliberately want real orders.

## Running

```bash
bun install
bun run dev        # watch mode
bun run start
bun run typecheck
bun run test       # Vitest
```

## Telegram bot setup

Order of steps matters: the bot token and secret go in `.env` first, then the server runs, then the webhook is registered.

### 1. Create the bot with @BotFather

1. In Telegram, open [@BotFather](https://t.me/BotFather) and send `/newbot`.
2. Choose a display name, then a username ending in `bot` (for example `usetenth_bot`).
3. BotFather replies with an HTTP API token. Put it in `.env` as `TELEGRAM_BOT_TOKEN`.
4. Optional but recommended: send `/setcommands`, pick your bot, and paste:

   ```text
   start - Get started
   balance - Show your balance
   tenth - View or change your tenth
   withdraw - Withdraw funds
   pause - Pause investing
   help - How it works
   ```

   Also `/setdescription` and `/setuserpic` for the bot profile.

### 2. Generate the webhook secret

Telegram sends this value in the `x-telegram-bot-api-secret-token` header, and the API rejects any request without it. Use 1 to 256 characters from `A-Z a-z 0-9 _ -`:

```bash
openssl rand -hex 32
```

Put the result in `.env` as `TELEGRAM_WEBHOOK_SECRET`.

### 3. Start the API (it opens the ngrok tunnel)

Set `NGROK_AUTHTOKEN` and `NGROK_TUNNEL_URL` in `.env`, then:

```bash
bun run dev
```

Startup logs the webhook URL, for example `Telegram webhook URL: https://<your-domain>/api/v1/telegram/webhook`. The ngrok request inspector at `http://127.0.0.1:4040` shows every call Telegram makes. If either ngrok variable is missing, no tunnel is started.

### 4. Register the webhook

Run from the `api/` folder so the values come from `.env`:

```bash
set -a; source .env; set +a
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://${NGROK_TUNNEL_URL#https://}/api/v1/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  -d "drop_pending_updates=true"
```

Expected reply: `{"ok":true,"result":true,"description":"Webhook was set"}`.

### 5. Verify

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Check that `url` is correct and `last_error_message` is absent. Then confirm the secret check works:

```bash
curl -i -X POST "https://${NGROK_TUNNEL_URL#https://}/api/v1/telegram/webhook"   # 403
curl -i -X POST "https://${NGROK_TUNNEL_URL#https://}/api/v1/telegram/webhook" \
  -H "x-telegram-bot-api-secret-token: $TELEGRAM_WEBHOOK_SECRET"                  # 200
```

Message your bot in Telegram: the call should appear in the ngrok inspector with a 200.

### Notes

- With a reserved ngrok domain the URL is stable, so `setWebhook` is a one-time step. If you change the domain, register again.
- To stop delivery, call `deleteWebhook`.

## Opening the web app from Telegram

The bot answers with inline `web_app` buttons, which open the web app in Telegram's in-app view.

- **One domain for both:** the API serves `/api/v1/*` itself and proxies everything else to the web app (`WEB_UPSTREAM_URL`), so the ngrok domain that already receives the webhook also serves the UI. Helmet's strict headers apply to the API only, so they cannot block the page inside Telegram.
- **Identity:** the page sends Telegram's signed `initData` as `Authorization: tma <initData>`. The API verifies the HMAC against the bot token and rejects stale or forged data (`src/services/telegram-auth.ts`). Opened outside Telegram, the app is the public demo.
- **Cards:** `/start`, `/tenth` and `/portfolio` reply with an image card (coins, candlesticks and one violet coin per tenth, in light) (welcome, your tenth, your portfolio), and an invested deposit sends the payment-received card. Cards are drawn on the server from SVG templates in `src/services/cards.ts` (`@resvg/resvg-js` with the Poppins fonts in `assets/fonts`, SIL Open Font License) so the numbers are always the user's own. If a card cannot be drawn or sent, the bot sends the same information as plain text.
- **Commands:** `/start` registers you and links the demo account to the first user who starts the bot; `/tenth`, `/portfolio`, `/buy`, `/sell`, `/deposit`, `/address` and `/withdraw` reply and deep-link into the web app. Replayed updates act once.
- **Your rule:** the web app saves your tenth to your Telegram user (`PUT /me/rule`) and loads it back once per session. A deposit for that user is then split across your assets; legs under the $1.00 minimum order are skipped instead of sent to fail, so an 8-stock mix needs at least $8 invested.
- **Saved but not enforced yet:** `holdWeekends` and `confirmEach` are stored on the rule but nothing acts on them until the rule engine (`plan()`) replaces the per-rule split in `investment.service`.
- **Deposits:** `/deposit` and `/address` show the address beside its network, with a warning, and two buttons into the web app: **Use a different network** and **Add funds from a bank**. For this account the address is its DeFi wallet on Solana (confirmed on-chain to hold the account's PYUSD): the account is not KYC-verified (`GET /v1/account/kyc/status` is all false), and True Markets rejects `POST /deposits/addresses` and bank details for unverified accounts, so those stay off until it is verified. Deposit details and test buys need demo access (below).
- **Not yet built:** withdrawals (off in demo), and saving your tenth to the API (the web app still keeps it in the browser).

### Testing it end to end

1. `cd web && bun run build && bun run start -p 3100`
2. `cd api && bun run dev` (starts the tunnel and prints the webhook URL)
3. In Telegram, send `/start`, then tap **Open usetenth**, or send `/portfolio` or `/tenth`.

Free ngrok domains show a one-time "visit site" warning page in a browser or webview; tap through it once. `next dev` also works behind the proxy, but Next blocks cross-origin dev assets unless the ngrok domain is listed in `allowedDevOrigins`, so a production build is simpler.

## Current status

Built: Telegram commands and web-app buttons, signed Telegram identity, True Markets client, asset catalog sync and S&P 500 gating, baskets, pure rule engine, deposit watcher, investment flow with demo guards, ledger tables, Express API.

Not built yet: withdrawals, settling `pending` DeFi orders, identity/KYC, wallet provisioning, withdrawals, nightly reconciliation, and the global-floor guard.

## Demo access and inviting judges

The demo runs on one shared True Markets account. Two kinds of user have access: the **owner** (the first user to `/start` the bot, linked to the account) and **invited testers**.

1. Put one or more codes in `INVITE_CODES`, for example `INVITE_CODES=JUDGE2026`.
2. Give judges this link: `https://t.me/<your_bot_username>?start=JUDGE2026`. Opening it sends `/start JUDGE2026`, which grants access, replies with a short guide, and offers **Try a buy** when test buys are on. Codes are case-insensitive and can be rotated by changing the env var; someone already granted keeps access, so clear their `access` field to revoke.
3. Without access a user can still use `/start`, `/help`, `/tenth`, `/portfolio` and the stock picker, but deposit details and buys are refused (403).

Access is checked from Telegram's signed `initData`, never from anything the client claims. This is a shared demo account, not a user account: the live product needs a white-label integration with True Markets so every user gets their own.

## Trying a real buy

Buying goes through True Markets' DeFi API: quote in the chain's USDC, sign each payload with your API key (`signTurnkey`), then submit (`executeTrade`). It is guarded in layers:

- **Off by default.** Set `TEST_BUY_ENABLED=true` and restart to allow it. `DRY_RUN` only governs the automatic pipeline.
- **Selling:** `/sell` lists what you own with a Sell button per stock. A user may only sell what their own ledger shows they bought, capped by what the shared wallet actually holds, so one judge cannot sell another's shares or the owner's. True Markets' $1.00 minimum applies to sales too, so a holding worth less cannot be sold until you buy more of it. Proceeds arrive as the chain's own USDC (USDG on Robinhood Chain), not PYUSD; where they land after that is confirmed only by a real sale. Sells settle from True Markets history like buys.
- **Two taps in the app.** Try a buy shows a live quote, then a confirmation that says real funds are spent.
- **Capped.** `TEST_BUY_MAX_USD` per buy, plus the demo per-user cap.
- **Slippage.** If you would get more than 1% fewer tokens than quoted, it is rejected before signing.
- **The order row is written first.** A repeated key returns the same order; a 4xx from True Markets marks it failed; a timeout or 5xx is treated as an unknown outcome and is never retried, so nothing is bought twice.

Verified with real money: two $1 buys (Apple on Base, Oracle on Robinhood Chain) were paid from the account's PYUSD alone, with no USDC needed, and True Markets' own app shows the same holdings. The submit response carries no executed quantity, so orders start `pending` and are **settled from account history**: the order poller pairs each pending buy with the `SUCCESS` history row for the same token (`src/services/history.pure.ts`), records the tokens actually received and the exact dollars spent as the cost basis, and marks a `FAILED` row failed. Note that the live history API uses camelCase (`toAsset`, `txHash`) while the SDK's types say snake_case; both are read.

**Demo limits:** each user may spend `MAX_USER_SPEND_USD` in total (default `$2`) and `MAX_ORDER_USD` per order. Reaching the limit shows a readable message and the buy page shows the allowance left; raise the env var to buy more.

## Known blocker: buying tokenized stocks

Order placement currently uses the retail gateway (`/quote`, `/orders`). Read-only probes on the demo account show that endpoint quotes **CeFi assets only** (BTC returns a price); every tokenized stock returns `unsupported asset`, with or without a `chain`. Stocks quote through the SDK's DeFi API (`defi.createQuote`, `POST /v1/defi/core/quote`): a $1 buy of AAPLC on Base returns 0.00296845 tokens, quoted in **Base USDC** with three payloads to sign, then `defi.executeTrade` with signatures (`auth.turnkeyStamp` is the SDK's signing helper). Robinhood-chain and Solana quotes returned 500s in the probe. The account's $50 is PYUSD on Solana, so a Base stock also needs USDC on Base. Order execution has to move to the DeFi API before a deposit can buy stocks; until then `DRY_RUN` quotes for stocks come back empty.

## Testing the automatic invest

`bun run simulate-deposit <amount>` prints what a payment of that size would buy for the owner's rule and writes nothing. Add `--run` to record it as a payment and run the pipeline (real buys when `DRY_RUN=false`, quotes otherwise), including the bot notification. Each leg must be at least $1.00, so a 10% rule on a $30 payment supports at most three stocks.
