import { env } from "../../config/env";
import { trueMarkets } from "./client";

const BASE = env.TM_ENV === "uat" ? "https://api.uat.truemarkets.co/v1/account" : "https://api.truemarkets.co/v1/account";

export class AccountApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`True Markets account API ${status}`);
  }
}

// The SDK's generated clients do not cover the Account API (deposits, KYC), so it is called directly with the same key's token.
async function token(): Promise<string> {
  await trueMarkets.authenticate();
  const t = (trueMarkets as unknown as { accessToken?: string }).accessToken;
  if (!t) throw new Error("no True Markets access token");
  return t;
}

export async function accountRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${await token()}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const parsed = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new AccountApiError(res.status, parsed);
  return parsed as T;
}
