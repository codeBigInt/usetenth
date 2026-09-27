import { env } from "./env";

/** Public URL of the web app (what Telegram opens): WEB_APP_URL, else the ngrok domain. */
export function webAppUrl(path = "/"): string | null {
  const domain = env.NGROK_TUNNEL_URL?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const base = env.WEB_APP_URL ?? (domain ? `https://${domain}` : null);
  return base ? `${base.replace(/\/+$/, "")}${path}` : null;
}
