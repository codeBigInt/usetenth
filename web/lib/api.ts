import { API_URL } from "./config";
import { authHeaders } from "./telegram";

export interface InvestableAsset {
  assetKey: string;
  symbol: string;
  displayName: string;
  kind: string;
  venue: string;
}

export async function fetchInvestable(signal?: AbortSignal): Promise<InvestableAsset[]> {
  const res = await fetch(`${API_URL}/assets/investable`, { signal, headers: authHeaders() });
  if (!res.ok) throw new Error(`Could not load stocks (${res.status})`);
  const body = (await res.json()) as { data: { assets: InvestableAsset[] } };
  return body.data.assets;
}

export interface Holding {
  assetKey: string;
  symbol: string;
  name: string;
  quantity: string;
  cost: string | null;
  price: string | null;
  value: string | null;
  owned: string;
}

export interface Portfolio {
  asset: string;
  cash: string;
  holdings: Holding[];
  invested: string;
  value: string;
  gain: string | null;
}

export async function fetchPortfolio(signal?: AbortSignal): Promise<Portfolio> {
  const res = await fetch(`${API_URL}/portfolio`, { signal, headers: authHeaders() });
  if (!res.ok) throw new Error(`Could not load your portfolio (${res.status})`);
  return ((await res.json()) as { data: Portfolio }).data;
}

export interface Me {
  user: { id: number; firstName: string | null; username: string | null } | null;
  mode: string;
  access: "owner" | "judge" | null;
  testBuy: boolean;
}

export async function fetchMe(signal?: AbortSignal): Promise<Me> {
  const res = await fetch(`${API_URL}/me`, { signal, headers: authHeaders() });
  if (!res.ok) throw new Error(`Could not load your session (${res.status})`);
  return ((await res.json()) as { data: Me }).data;
}

export interface RuleView {
  percent: number;
  mixId: string | null;
  holdWeekends: boolean;
  confirmEach: boolean;
  allocations: { assetKey: string; ticker: string; name: string; percentage: string }[];
}

export interface RuleInput {
  percent: number;
  mixId: string;
  holdWeekends: boolean;
  confirmEach: boolean;
  picks: { assetKey?: string; ticker?: string }[];
}

export async function fetchRule(signal?: AbortSignal): Promise<RuleView | null> {
  const res = await fetch(`${API_URL}/me/rule`, { signal, headers: authHeaders() });
  if (!res.ok) throw new Error(`Could not load your settings (${res.status})`);
  return ((await res.json()) as { data: { rule: RuleView | null } }).data.rule;
}

export async function saveRule(input: RuleInput): Promise<RuleView & { skipped: string[] }> {
  const res = await fetch(`${API_URL}/me/rule`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => null)) as { message?: string; data?: { rule: RuleView & { skipped: string[] } } } | null;
  if (!res.ok || !body?.data) throw new Error(body?.message ?? `Could not save (${res.status})`);
  return body.data.rule;
}

export interface DepositNetwork {
  network: string;
  compatible: string[];
  address: string | null;
  source: "deposit" | "wallet" | null;
}

export interface Deposits {
  asset: string;
  networks: DepositNetwork[];
  canCreate: boolean;
  wire: Record<string, unknown>[];
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as { message?: string; data?: T } | null;
  if (!res.ok || !json?.data) throw new Error(json?.message ?? `Request failed (${res.status})`);
  return json.data;
}

export const fetchDeposits = () => send<Deposits>("/deposits", "GET");
export const createDepositAddress = (network: string) => send<{ asset: string; networks: DepositNetwork[]; canCreate: boolean }>("/deposits/addresses", "POST", { network });
export const createWireInstructions = () => send<{ wire: Record<string, unknown>[] }>("/deposits/wire-instructions", "POST", {});

export interface TradePreview {
  assetKey: string;
  name: string;
  chain: string;
  amount: string;
  qtyOut: string;
  price: string | null;
  fee: string;
  issues: string[];
  enabled: boolean;
  minUsd: string;
  maxUsd: string;
  remainingUsd: string | null;
}

export interface TradeResult {
  orderId: string;
  status: string;
  txHash: string | null;
  executedQty: string | null;
  price: string | null;
  fee: string | null;
}

export const fetchQuote = (assetKey: string, amount: string) => send<TradePreview>("/trades/quote", "POST", { assetKey, amount });
export const placeBuy = (body: { assetKey: string; amount: string; minQtyOut: string; idempotencyKey: string }) => send<TradeResult>("/trades/buy", "POST", body);

export interface SellPreview {
  assetKey: string;
  name: string;
  chain: string;
  qty: string;
  receive: string;
  price: string | null;
  fee: string;
  receiveAsset: string | null;
  issues: string[];
  enabled: boolean;
}

export const fetchSellQuote = (assetKey: string) => send<SellPreview>("/trades/sell/quote", "POST", { assetKey });
export const placeSell = (body: { assetKey: string; minReceive: string; idempotencyKey: string }) => send<TradeResult>("/trades/sell", "POST", body);
