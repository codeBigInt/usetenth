import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { dec, usd } from "../utils/money";

export interface NamedAmount {
  name: string;
  amount: string;
}

export type CardSpec =
  | { kind: "welcome" }
  | { kind: "tenth"; percent: number; mixName: string }
  | { kind: "portfolio"; worth: string; gain: string | null; invested: string; cash: string; holdings: NamedAmount[] }
  | { kind: "payment"; amount: string; invested: string; kept: string; bought: NamedAmount[] };

export type Theme = "light" | "dark";

const W = 1080;

interface Palette {
  bg: string;
  card: string;
  ink: string;
  mute: string;
  line: string;
  chip: string;
  violet: string;
  green: string;
  red: string;
  dot: string;
}

const PALETTES: Record<Theme, Palette> = {
  light: { bg: "#F7F7FB", card: "#FFFFFF", ink: "#12131A", mute: "#5B5E6E", line: "#E4E4EF", chip: "#F5F5FA", violet: "#5B3DF5", green: "#0E9F6E", red: "#E5484D", dot: "#C8C9DA" },
  dark: { bg: "#0B0D17", card: "#151827", ink: "#F7F7FB", mute: "#9A9CAD", line: "#262A40", chip: "#1D2135", violet: "#8A72FF", green: "#34D399", red: "#FF6B70", dot: "#3A3F5C" },
};

const asset = (path: string) => fileURLToPath(new URL(`../../assets/${path}`, import.meta.url));
const FONT_FILES = ["Regular", "Medium", "SemiBold", "Bold"].map((w) => asset(`fonts/Poppins-${w}.ttf`));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Poppins runs about 0.58em per character; cut with an ellipsis rather than overflow the card. */
const fit = (s: string, maxWidth: number, size: number) => {
  const max = Math.max(4, Math.floor(maxWidth / (size * 0.58)));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

interface TextOpts {
  fill: string;
  size: number;
  weight?: number;
  anchor?: "start" | "end";
}
const text = (x: number, y: number, s: string, { size, weight = 400, fill, anchor = "start" }: TextOpts) =>
  `<text x="${x}" y="${y}" font-family="Poppins" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

const shortUsd = (v: string) => usd(v).replace(/\.00$/, "");
const rect = (x: number, y: number, w: number, h: number, r: number, fill: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const line = (y: number, p: Palette) => `<rect x="104" y="${y}" width="872" height="2" fill="${p.line}"/>`;

// Brand mark geometry (64px grid); the first dot is the violet "one in ten".
const MARK = [[32, 10, 4.4], [44.93, 14.2, 3.2], [52.92, 25.2, 3.0], [52.92, 38.8, 2.8], [44.93, 49.8, 2.6], [32, 54, 2.4], [19.07, 49.8, 2.6], [11.08, 38.8, 2.8], [11.08, 25.2, 3.0], [19.07, 14.2, 3.2]] as const;
const mark = (cx: number, cy: number, scale: number, p: Palette) =>
  `<g transform="translate(${cx - 32 * scale} ${cy - 32 * scale}) scale(${scale})">${MARK.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i === 0 ? p.violet : p.ink}"/>`).join("")}</g>`;

// ---- Illustration: coins, candlesticks and sparkles, drawn in a 430 x 390 box ----

const DEFS = `<defs>
<linearGradient id="tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8467FF"/><stop offset="0.55" stop-color="#5B3DF5"/><stop offset="1" stop-color="#3B22C9"/></linearGradient>
<radialGradient id="glow" cx="0.25" cy="0.15" r="0.75"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.34"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<linearGradient id="goldSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#A9680F"/><stop offset="0.3" stop-color="#F1C654"/><stop offset="0.5" stop-color="#FFF0A8"/><stop offset="0.78" stop-color="#E3A934"/><stop offset="1" stop-color="#9C5D0B"/></linearGradient>
<radialGradient id="goldTop" cx="0.4" cy="0.35" r="0.85"><stop offset="0" stop-color="#FFF2B0"/><stop offset="0.55" stop-color="#F6C445"/><stop offset="1" stop-color="#D98F1F"/></radialGradient>
<linearGradient id="vioSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#35209F"/><stop offset="0.3" stop-color="#7D63FF"/><stop offset="0.5" stop-color="#B9A8FF"/><stop offset="0.78" stop-color="#6B4FF0"/><stop offset="1" stop-color="#2E1A8C"/></linearGradient>
<radialGradient id="vioTop" cx="0.4" cy="0.35" r="0.85"><stop offset="0" stop-color="#D6CCFF"/><stop offset="0.55" stop-color="#8E77FF"/><stop offset="1" stop-color="#5B3DF5"/></radialGradient>
<filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>`;

type CoinKind = "gold" | "vio";

/** One coin: side band plus a lit top face. `tilt` is the ellipse ratio (0.36 lies flat, 1 faces us). */
function coin(cx: number, cy: number, R: number, T: number, kind: CoinKind, tilt = 0.36, symbol?: string): string {
  const ry = R * tilt;
  const side = kind === "gold" ? "goldSide" : "vioSide";
  const top = kind === "gold" ? "goldTop" : "vioTop";
  const rim = kind === "gold" ? "#FFF6C8" : "#E4DDFF";
  const groove = kind === "gold" ? "#B97A14" : "#3E27B5";
  const face = kind === "gold" ? "#A8680E" : "#33209C";
  return [
    `<path d="M${cx - R} ${cy} L${cx - R} ${cy + T} A${R} ${ry} 0 0 0 ${cx + R} ${cy + T} L${cx + R} ${cy} Z" fill="url(#${side})"/>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${ry}" fill="url(#${top})" stroke="${rim}" stroke-width="2.2" stroke-opacity="0.85"/>`,
    `<ellipse cx="${cx}" cy="${cy}" rx="${R * 0.78}" ry="${ry * 0.78}" fill="none" stroke="${groove}" stroke-width="2" stroke-opacity="0.45"/>`,
    symbol ? `<text transform="translate(${cx} ${cy + R * 0.3 * tilt * 1.2}) scale(1 ${tilt})" font-family="Poppins" font-weight="700" font-size="${R * 1.05}" fill="${face}" fill-opacity="0.75" text-anchor="middle">${symbol}</text>` : "",
  ].join("");
}

/** A stack, bottom to top; the top `accent` coins are violet: the tenth that gets invested. */
function stack(cx: number, baseY: number, R: number, T: number, count: number, accent: number): string {
  let out = `<ellipse cx="${cx}" cy="${baseY + T + 6}" rx="${R * 1.05}" ry="${R * 0.3}" fill="#1A0C66" fill-opacity="0.45" filter="url(#blur)"/>`;
  for (let i = 0; i < count; i++) {
    const isTop = i === count - 1;
    out += coin(cx, baseY - i * T, R, T, i >= count - accent ? "vio" : "gold", 0.36, isTop ? "$" : undefined);
  }
  return out;
}

const spark = (x: number, y: number, s: number, o = 0.9) =>
  `<path d="M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z" fill="#FFFFFF" fill-opacity="${o}"/>`;

/** Candlesticks: an unmistakable stock-market cue, kept behind the coins. */
function candles(x0: number, base: number): string {
  const c: [number, number, number, boolean][] = [
    [60, 34, 0, true], [84, 30, 1, false], [108, 44, 2, true], [140, 36, 3, true], [172, 52, 4, true], [190, 34, 5, false], [232, 62, 6, true],
  ];
  return c
    .map(([top, h, i, up]) => {
      const x = x0 + i * 36;
      const color = up ? "#5EF0B0" : "#FF8A8F";
      return `<rect x="${x + 10}" y="${base - top - 20}" width="3.5" height="${h + 40}" rx="2" fill="${color}" fill-opacity="0.75"/><rect x="${x}" y="${base - top}" width="23" height="${h}" rx="5" fill="${color}" fill-opacity="0.62"/>`;
    })
    .join("");
}

/** The hero tile: violet gradient, candlesticks, a coin stack, a floating coin and sparkles. */
function hero(x: number, y: number, w: number, h: number, count: number, accent: number): string {
  const s = Math.min(w / 430, h / 390);
  const id = `clip${x}_${y}`;
  const art = [
    `<rect width="430" height="390" fill="url(#tile)"/>`,
    `<rect width="430" height="390" fill="url(#glow)"/>`,
    candles(176, 372),
    stack(196, 300, 92, 15, count, accent),
    `<g transform="rotate(-20 104 118)">${coin(104, 118, 48, 12, "gold", 0.9, "$")}</g>`,
    `<g transform="rotate(14 92 330)">${coin(92, 330, 46, 12, "gold", 0.42)}</g>`,
    spark(380, 62, 22),
    spark(58, 232, 16, 0.85),
    spark(250, 44, 11, 0.7),
    spark(404, 150, 10, 0.6),
    spark(240, 150, 8, 0.55),
  ].join("");
  const tx = x + (w - 430 * s) / 2;
  const ty = y + (h - 390 * s) / 2;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="36"/></clipPath><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="36" fill="url(#tile)"/><g clip-path="url(#${id})"><g transform="translate(${tx} ${ty}) scale(${s})">${art}</g></g>`;
}

function frame(height: number, body: string, p: Palette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">
${DEFS}
${rect(0, 0, W, height, 0, p.bg)}
${rect(40, 40, 1000, height - 80, 48, p.card)}
${mark(104, 104, 1.5, p)}
${text(155, 116, "usetenth", { size: 36, weight: 700, fill: p.ink })}
${body}
</svg>`;
}

function welcome(p: Palette): string {
  const box = (x: number, title: string, desc: string) =>
    `${rect(x, 424, 280, 130, 24, p.chip)}${text(x + 27, 473, title, { size: 20, weight: 600, fill: p.violet })}${text(x + 27, 510, desc, { size: 20, fill: p.mute })}`;
  return frame(
    620,
    [
      hero(736, 100, 240, 218, 6, 1),
      text(104, 248, "Keep a tenth.", { size: 56, weight: 700, fill: p.ink }),
      text(104, 320, "We invest it for you.", { size: 56, weight: 700, fill: p.violet }),
      text(104, 378, "Every payment you receive, a slice goes straight into stocks.", { size: 26.5, fill: p.mute }),
      box(104, "1 · Set your tenth", "5%, 10% or 20%"),
      box(400, "2 · Get paid", "In stablecoins, as usual"),
      box(696, "3 · It invests", "Before you can spend it"),
    ].join("\n"),
    p,
  );
}

function tenth(s: Extract<CardSpec, { kind: "tenth" }>, p: Palette): string {
  return frame(
    620,
    [
      hero(72, 150, 430, 390, 10, Math.max(1, Math.round(s.percent / 10))),
      text(560, 268, "Your tenth", { size: 24, fill: p.mute }),
      text(560, 358, `${s.percent}%`, { size: 84, weight: 700, fill: p.ink }),
      text(560, 405, "of every payment", { size: 24, fill: p.mute }),
      rect(560, 440, 416, 112, 24, p.chip),
      text(588, 482, "Mix", { size: 22, fill: p.mute }),
      text(588, 524, fit(s.mixName, 360, 24), { size: 24, weight: 700, fill: p.ink }),
    ].join("\n"),
    p,
  );
}

function portfolio(s: Extract<CardSpec, { kind: "portfolio" }>, p: Palette): string {
  const rows = s.holdings.length > 3 ? [...s.holdings.slice(0, 2), null] : s.holdings;
  const height = 680 + Math.max(0, rows.length - 2) * 44;
  const gain = s.gain === null ? (s.holdings.length === 0 ? "Nothing invested yet" : "") : `${dec(s.gain).isNegative() ? "" : "+"}${usd(s.gain)} since you started`;
  const gainColor = s.gain !== null && dec(s.gain).isNegative() ? p.red : s.gain !== null ? p.green : p.mute;
  const list =
    rows.length === 0
      ? text(104, 575, "Your first payment will show up here", { size: 24, fill: p.mute })
      : rows
          .map((h, i) => {
            const y = 575 + i * 44;
            return h
              ? text(104, y, fit(h.name, 560, 24), { size: 24, weight: 700, fill: p.ink }) + text(976, y, usd(h.amount), { size: 24, anchor: "end", fill: p.ink })
              : text(104, y, `and ${s.holdings.length - 2} more`, { size: 24, fill: p.mute });
          })
          .join("\n");
  return frame(
    height,
    [
      hero(716, 100, 260, 236, 6, 1),
      text(104, 215, "Worth today", { size: 24, fill: p.mute }),
      text(104, 303, usd(s.worth), { size: 76, weight: 700, fill: p.ink }),
      gain ? text(104, 348, gain, { size: 26, weight: 500, fill: gainColor }) : "",
      line(394, p),
      text(104, 441, "Invested", { size: 22, fill: p.mute }),
      text(104, 486, usd(s.invested), { size: 35, fill: p.ink }),
      text(560, 441, "Ready to withdraw", { size: 22, fill: p.mute }),
      text(560, 486, usd(s.cash), { size: 35, fill: p.ink }),
      line(528, p),
      list,
    ].join("\n"),
    p,
  );
}

function payment(s: Extract<CardSpec, { kind: "payment" }>, p: Palette): string {
  const total = dec(s.amount);
  const share = total.isZero() ? 0 : Math.min(1, dec(s.invested).div(total).toNumber());
  const fill = share > 0 ? Math.max(26, Math.round(872 * share)) : 0;
  const first = s.bought.slice(0, 2).map((b) => `${shortUsd(b.amount)} ${fit(b.name, 280, 26)}`);
  const more = s.bought.length > 2 ? ` · and ${s.bought.length - 2} more` : "";
  const height = s.bought.length > 0 ? 660 : 560;
  return frame(
    height,
    [
      hero(736, 100, 240, 218, 6, 1),
      text(104, 215, "Payment received", { size: 24, fill: p.mute }),
      text(104, 303, usd(s.amount), { size: 76, weight: 700, fill: p.ink }),
      rect(104, 350, 872, 26, 13, p.line),
      fill > 0 ? rect(104, 350, fill, 26, 13, p.violet) : "",
      `<circle cx="117" cy="424" r="10" fill="${p.violet}"/>`,
      text(142, 434, `${usd(s.invested)} invested`, { size: 24, fill: p.ink }),
      `<circle cx="117" cy="474" r="10" fill="${p.dot}"/>`,
      text(142, 484, `${usd(s.kept)} ready to withdraw`, { size: 24, fill: p.ink }),
      s.bought.length > 0 ? line(522, p) : "",
      s.bought.length > 0 ? text(104, 568, "Bought", { size: 22, fill: p.mute }) : "",
      s.bought.length > 0 ? text(104, 610, first.join(" · ") + more, { size: 26, weight: 700, fill: p.ink }) : "",
    ].join("\n"),
    p,
  );
}

export function cardSvg(spec: CardSpec, theme: Theme = "dark"): string {
  const p = PALETTES[theme];
  switch (spec.kind) {
    case "welcome":
      return welcome(p);
    case "tenth":
      return tenth(spec, p);
    case "portfolio":
      return portfolio(spec, p);
    case "payment":
      return payment(spec, p);
  }
}

export function renderCard(spec: CardSpec, theme: Theme = "dark"): Buffer {
  const resvg = new Resvg(cardSvg(spec, theme), { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Poppins" } });
  return resvg.render().asPng();
}

export function paymentCardSpec(i: { amount: string; investmentAmount: string; bought: NamedAmount[] }): CardSpec {
  return { kind: "payment", amount: i.amount, invested: i.investmentAmount, kept: dec(i.amount).minus(i.investmentAmount).toFixed(2), bought: i.bought };
}
