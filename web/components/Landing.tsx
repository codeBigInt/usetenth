import { DotRing, Logo, ThemeToggle } from "@/components/ui";
import { BOT_URL } from "@/lib/config";

const STEPS = [
  { title: "Get paid as usual", body: "Invoices land in stablecoins. Nothing about how you work changes." },
  { title: "A tenth moves automatically", body: "Each payment triggers your rule. Pick 5, 10 or 20 percent and a mix." },
  { title: "It becomes real stock", body: "Tokenized S&P 500 companies like Apple and Oracle, bought on True Markets." },
];

export function Landing() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pb-10">
      <header className="flex items-center justify-between pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Logo />
        <ThemeToggle />
      </header>

      <section className="grid items-center gap-10 py-10 md:grid-cols-[1.2fr_1fr] md:py-20">
        <div>
          <h1 className="text-4xl font-semibold leading-tight md:text-6xl">Save a tenth of every payment, in stocks.</h1>
          <p className="mt-5 max-w-xl text-lg text-mute">
            usetenth is for freelancers paid in stablecoins. Set a rule once and a slice of each payment is invested for you, without you moving a thing.
          </p>
          <a href={BOT_URL} className="mt-8 inline-flex h-14 items-center justify-center rounded-full bg-violet px-8 font-semibold text-white">
            Open in Telegram
          </a>
          <p className="mt-3 text-sm text-mute">Runs inside Telegram. No app to install. Trades run on True Markets.</p>
        </div>

        <div className="mx-auto w-full max-w-xs rounded-3xl border border-line bg-card/90 p-6 text-center shadow-sm">
          <DotRing percent={10} className="mx-auto h-16 w-16" />
          <p className="mt-3 font-medium">Scan to start</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bot-qr.svg" alt="QR code for the usetenth Telegram bot" className="mx-auto mt-3 w-full max-w-[220px] dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bot-qr-dark.svg" alt="" className="mx-auto mt-3 hidden w-full max-w-[220px] dark:block" />
          <p className="mt-3 text-sm text-mute">Point your phone camera at it, or open t.me/usetenth_bot</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-2xl border border-line bg-card/90 p-5">
            <p className="num text-sm text-violet">0{i + 1}</p>
            <h2 className="mt-1 font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-mute">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-line bg-card/90 p-6 md:flex md:items-center md:justify-between md:gap-8">
        <div>
          <p className="text-sm text-violet">Built on True Markets</p>
          <h2 className="mt-1 text-xl font-semibold">Real shares of real companies, not a simulation.</h2>
          <p className="mt-2 max-w-2xl text-sm text-mute">
            Every purchase is a live trade on <a href="https://truemarkets.co" className="font-medium text-ink underline underline-offset-2">True Markets</a>: quoted, signed and settled on-chain as tokenized stocks, and sold back to stablecoins whenever you choose. Prices are the ones True Markets quotes, never ours.
          </p>
        </div>
        <ul className="mt-4 grid shrink-0 gap-2 text-sm md:mt-0">
          <li className="rounded-full border border-line px-4 py-2">Tokenized S&amp;P 500 stocks</li>
          <li className="rounded-full border border-line px-4 py-2">Live quotes, 1% price protection</li>
          <li className="rounded-full border border-line px-4 py-2">Sell back to stablecoins</li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-card/90 p-5 text-sm text-mute">
        <p className="font-medium text-ink">A demo, running on real money.</p>
        <p className="mt-1">
          This build trades a single funded True Markets account with small per-order limits, so trying it is invite-only. Send the bot /start with an invite link from the team to unlock buying and selling.
        </p>
      </section>
    </div>
  );
}
