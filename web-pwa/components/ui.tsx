"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/tenth-lockup.svg" alt="usetenth" className={`${className} w-auto dark:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/tenth-lockup-dark.svg" alt="usetenth" className={`${className} hidden w-auto dark:block`} />
    </>
  );
}

export function Mark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/tenth-mark.svg" alt="" className={`${className} dark:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/tenth-mark-dark.svg" alt="" className={`${className} hidden dark:block`} />
    </>
  );
}

const RING = [
  [32, 11, 5.6], [44.34, 15.01, 4.4], [51.97, 25.51, 4.2], [51.97, 38.49, 4.0], [44.34, 48.99, 3.8],
  [32, 53, 3.6], [19.66, 48.99, 3.8], [12.03, 38.49, 4.0], [12.03, 25.51, 4.2], [19.66, 15.01, 4.4],
] as const;

export function DotRing({ percent, className = "h-32 w-32" }: { percent: number; className?: string }) {
  const filled = Math.max(1, Math.round(percent / 10));
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={`${percent} percent`}>
      {RING.map(([cx, cy, r], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill={i < filled ? "var(--violet)" : "var(--ink)"}
          opacity={i === 0 && percent < 10 ? 0.55 : 1}
        />
      ))}
    </svg>
  );
}

export function ThemeToggle() {
  const toggle = () => {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("usetenth:theme", dark ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card/80 text-ink"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}

export function BackButton({ href }: { href?: string }) {
  const router = useRouter();
  const cls = "flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card/80 text-ink";
  const icon = (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
  return href ? (
    <Link href={href} aria-label="Back" className={cls}>
      {icon}
    </Link>
  ) : (
    <button onClick={() => router.back()} aria-label="Back" className={cls}>
      {icon}
    </button>
  );
}

interface ScreenProps {
  title?: string;
  subtitle?: string;
  back?: string | boolean;
  brand?: boolean;
  right?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function Screen({ title, subtitle, back, brand, right, footer, children }: ScreenProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
      <header className="flex items-center gap-3 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {back ? <BackButton href={typeof back === "string" ? back : undefined} /> : null}
        {brand ? <Mark /> : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-mute">{subtitle}</p> : null}
        </div>
        {right}
      </header>
      <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">{children}</main>
      {footer ? (
        <footer className="sticky bottom-0 border-t border-line bg-bg/85 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-card/90 p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Chip({ active, className = "", ...props }: { active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      aria-pressed={active}
      className={`num h-12 flex-1 rounded-full border text-sm transition ${
        active ? "border-violet bg-violet/10 text-violet" : "border-line bg-card text-ink"
      } ${className}`}
    />
  );
}

const btn = "flex h-14 w-full items-center justify-center rounded-full text-base font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100";

export function PrimaryButton({ href, className = "", ...props }: { href?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `${btn} bg-violet text-white shadow-[0_8px_24px_-8px_rgba(91,61,245,0.7)] ${className}`;
  return href ? <Link href={href} className={cls}>{props.children}</Link> : <button {...props} className={cls} />;
}

export function SecondaryButton({ href, className = "", ...props }: { href?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `${btn} border border-line bg-card text-ink ${className}`;
  return href ? <Link href={href} className={cls}>{props.children}</Link> : <button {...props} className={cls} />;
}

export function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--violet)]" />
      <span>
        <span className="block text-[15px] font-medium leading-snug">{label}</span>
        <span className="block text-sm text-mute">{hint}</span>
      </span>
    </label>
  );
}
