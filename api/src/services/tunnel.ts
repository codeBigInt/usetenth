import ngrok from "@ngrok/ngrok";
import { env } from "../config/env";

const tunnelDomain = () => env.NGROK_TUNNEL_URL?.replace(/^https?:\/\//, "").replace(/\/+$/, "");

export const telegramWebhookUrl = () => `https://${tunnelDomain()}/api/v${env.API_VERSION}/telegram/webhook`;

export async function startTunnel(port: number) {
  const domain = tunnelDomain();
  if (!env.NGROK_AUTHTOKEN || !domain) return null;
  return ngrok.forward({ addr: port, authtoken: env.NGROK_AUTHTOKEN, domain });
}
