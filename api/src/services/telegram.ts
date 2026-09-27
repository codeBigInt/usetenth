import { env } from "../config/env";

export interface WebAppButton {
  text: string;
  url: string;
}

type Buttons = WebAppButton | WebAppButton[];

// One button per row so long labels stay readable.
const markup = (buttons?: Buttons) => {
  const list = buttons ? (Array.isArray(buttons) ? buttons : [buttons]) : [];
  return list.length ? { inline_keyboard: list.map((b) => [{ text: b.text, web_app: { url: b.url } }]) } : undefined;
};

async function call(method: string, body: string | FormData, headers?: Record<string, string>): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers, body });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!json?.ok) throw new Error(`telegram ${method} failed: ${json?.description ?? res.status}`);
}

/** Text and captions are HTML (bold, code, quotes); callers escape anything that is not their own markup. */
export const sendMessage = (chatId: number, text: string, buttons?: Buttons) =>
  call("sendMessage", JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: markup(buttons) }), {
    "content-type": "application/json",
  });

export async function sendPhoto(chatId: number, png: Buffer, caption?: string, buttons?: Buttons): Promise<void> {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("photo", new Blob([new Uint8Array(png)], { type: "image/png" }), "usetenth.png");
  if (caption) {
    form.set("caption", caption);
    form.set("parse_mode", "HTML");
  }
  const reply = markup(buttons);
  if (reply) form.set("reply_markup", JSON.stringify(reply));
  await call("sendPhoto", form);
}
