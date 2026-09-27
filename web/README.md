# usetenth web app

Mobile-first PWA for **usetenth**: choose how much of each payment to keep invested, pick a mix of S&P 500 stocks, see the portfolio, and withdraw. Built with Next.js (App Router), Tailwind CSS 4 and TypeScript. The API lives in [`../api`](../api).

## Screens

| Route | Screen |
| --- | --- |
| `/` | Landing page with a QR code for the bot in a browser; inside Telegram, setup: pick the percentage and a mix (redirects to `/portfolio` once done) |
| `/portfolio` | Worth today, invested vs ready to withdraw, holdings, nudge to raise the tenth |
| `/tenth` | Percentage (5, 10, 20 or custom 1 to 50), mix, weekend hold, confirm before each buy |
| `/tenth/mix` | Presets plus a searchable picker of every stock the API says can be bought right now |
| `/payment` | Example of how a payment is split, using your settings |
| `/withdraw` | Amount and address with validation; the button is disabled in demo mode |
| `/buy` | Try a buy (demo access): pick a stock and $1 or $2, see a live quote, confirm to spend real funds. Buys only go through when the server has `TEST_BUY_ENABLED=true` |
| `/sell` | Sell a holding (demo access): live quote of what you would receive, two-step confirm. Reached from the Sell button on each holding or the bot's `/sell` |
| `/add-funds` | Deposit flow (Telegram only): pick a network, see its address with a copy button and a network warning, and add funds from a bank once the account is verified |

## What is real and what is not

- **Real, from the demo's single True Markets account:** the portfolio (`GET /api/v1/portfolio`: cash available, holdings priced by live quote, cost basis from the API's ledger) and the withdraw limit. Right now that means the account's real balance and an honest "nothing invested yet" until the first order fills.
- **Real, from the API:** the stock picker (`GET /api/v1/assets/investable`, whitelisted crypto plus tradeable S&P 500 stocks).
- **Example only:** `/payment` and the nudge card use a sample $800 payment (`lib/config.ts`) to show how your settings would split money. The screen is labelled "Example payment".
- **Your tenth:** opened from Telegram, Save writes your percentage, mix and options to your account (`PUT /me/rule`) and the app loads them back once per session. Stocks that cannot be bought right now are named on screen and left out. Outside Telegram there is no account, so settings stay in `localStorage` and the screen says so.
- **Not wired:** "Verify my identity" only marks onboarding done, and withdrawals are disabled in demo mode.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `/api/v1` | API base URL. Same-origin by default: the API answers it behind the public domain, and `next.config.ts` rewrites it to `API_INTERNAL_URL` (default `http://localhost:3000`) when the web app runs on its own port |
| `NEXT_PUBLIC_APP_MODE` | `demo` | Set to `live` to enable the withdraw button |
| `NEXT_PUBLIC_BOT_URL` | `https://t.me/usetenth_bot` | Where the landing page's Open in Telegram button points. The QR image is a static file: regenerate it with `bun run qr <url>` |
| `NEXT_PUBLIC_WITHDRAW_ASSET` / `NEXT_PUBLIC_WITHDRAW_NETWORK` | `USDC` / `Base` | The withdraw screen's target |
| `NEXT_PUBLIC_SAMPLE_PAYMENT` | `800.00` | The example payment used in the raise-your-tenth nudge |
| `API_INTERNAL_URL` | `http://localhost:3000` | Server side only. Where `/api/v1` is forwarded when the web app runs on its own port |

`NEXT_PUBLIC_*` values are inlined at build time, so rebuild after changing them. Copy `.env.example` to `.env.local` to set them.

## Running

```bash
bun install
bun run dev -p 3100   # the API uses 3000
bun run build && bun run start -p 3100
bun run typecheck
bun run test       # Vitest
```

Run the API first (`cd ../api && bun run dev`) so the stock picker has data.

## Inside Telegram

The bot's buttons open this app as a Telegram Web App. `components/TelegramBridge.tsx` calls `ready()` and `expand()`. `lib/telegram.ts` attaches Telegram's signed `initData` to every API call, and the portfolio greets you by name once the API has verified it. See the API README for how to serve both behind one domain.


## Design notes

- Colors and spacing are CSS variables in `app/globals.css`. Light is the default; the toggle switches to dark and remembers it under `usetenth:theme`. Bot cards are always light.
- Money is never a float: `lib/money.ts` works in integer cents (`BigInt`) and is covered by `tests/money.test.ts`.
- Brand assets are in `public/brand/`; PWA icons in `public/icons/`; the manifest is `app/manifest.ts`.
- The withdraw copy names the target asset and network in `lib/config.ts` (`WITHDRAW_TARGET`, currently USDC on Base, as in the mockup). The True Markets account settles in PYUSD on Solana, so decide which network withdrawals should use before enabling them.
