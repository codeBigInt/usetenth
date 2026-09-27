import { env } from "../../config/env";
import type { gateway } from "@truemarkets/sdk";
import Decimal from "decimal.js";
import { trueMarkets } from "./client";

export class TrueMarketsError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`True Markets ${status}: ${(body as { message?: string } | null)?.message ?? "request failed"}`);
  }
}

export interface OrderTarget {
  baseAsset: string;
  chain?: string;
}

/** Only place in the codebase that touches @truemarkets/sdk. */
export class TrueMarketsService {
  async quote(target: OrderTarget, amount: string) {
    const { data } = await trueMarkets.gateway.computeQuote({
      body: { base_asset: target.baseAsset, quote_asset: env.TM_SETTLEMENT_ASSET, qty: amount, qty_unit: "quote", side: "buy" },
    });
    return data;
  }

  /** Price per token, including the quote's spread. DeFi assets (chain set) price through the DeFi API. */
  async priceOf(target: OrderTarget): Promise<string | null> {
    if (target.chain) {
      const quote = await this.defiQuoteBuy(target, "1.00").catch(() => null);
      return quote?.qty_out && new Decimal(quote.qty_out).gt(0) ? new Decimal(1).div(quote.qty_out).toSignificantDigits(8).toFixed() : null;
    }
    const data = await this.quote(target, "1.00").catch(() => null);
    return data?.price ?? null;
  }

  /** Tokenized stocks and other DeFi assets: quoted in the chain's own USDC, executed with the API key's signatures. */
  async defiQuoteBuy(target: OrderTarget, amount: string) {
    if (!target.chain) throw new Error("not a DeFi asset");
    const { data, error, response } = await trueMarkets.defi.createQuote({
      body: { chain: target.chain, base_asset: target.baseAsset, order_side: "buy", qty: amount, qty_unit: "quote" },
    });
    if (!data) throw new TrueMarketsError(response?.status ?? 0, error);
    return data;
  }

  /** Sells `qty` tokens; the proceeds arrive in the chain's own USDC (or USDG on Robinhood Chain). */
  async defiQuoteSell(target: OrderTarget, qty: string) {
    if (!target.chain) throw new Error("not a DeFi asset");
    const { data, error, response } = await trueMarkets.defi.createQuote({
      body: { chain: target.chain, base_asset: target.baseAsset, order_side: "sell", qty, qty_unit: "base" },
    });
    if (!data) throw new TrueMarketsError(response?.status ?? 0, error);
    return data;
  }

  /** Signs every payload with the API key, in order. Nothing leaves the machine, so a failure here is always safe. */
  async defiSign(payloads: { digest: string; payload: string }[]): Promise<string[]> {
    const signatures: string[] = [];
    for (const p of payloads) signatures.push(await trueMarkets.signTurnkey(p.payload));
    return signatures;
  }

  /** The step that moves money. */
  async defiSubmit(quoteId: string, signatures: string[]) {
    const { data, error, response } = await trueMarkets.defi.executeTrade({ body: { quote_id: quoteId, signatures, auth_type: "api_key" } });
    if (!data) throw new TrueMarketsError(response?.status ?? 0, error);
    return data;
  }

  async createBuyOrder(target: OrderTarget, amount: string) {
    const { data } = await trueMarkets.gateway.createOrder({
      body: {
        base_asset: target.baseAsset,
        chain: target.chain as gateway.Chain | undefined,
        quote_asset: env.TM_SETTLEMENT_ASSET,
        qty: amount,
        qty_unit: "quote",
        type: "market",
        side: "buy",
      },
    });
    if (!data?.order_id) {
        return { kind: "rejected" as const, issues: data?.quote?.issues ?? [] };
    }
    if (data.payloads?.length) {
      return { kind: "needs_signing" as const, orderId: data.order_id, payloads: data.payloads };
    }
    return { kind: "submitted" as const, orderId: data.order_id, status: data.status };
  }

  async executeOrder(orderId: string, signatures: string[]) {
    const { data } = await trueMarkets.gateway.executeOrder({
      path: { id: orderId },
      body: { signatures, auth_type: "api_key" },
    });
    return data;
  }

  // asset_class defaults to crypto server-side; stocks must be requested explicitly.
  async listAssets() {
    // The SDK's generated query type lacks asset_class.
    const query = { asset_class: "crypto,stock" } as unknown as { venue?: never };
    const { data, error } = await trueMarkets.gateway.listAssets({ query });
    return { data, error };
  }

  async listBalances() {
    const { data, error } = await trueMarkets.gateway.listBalances();
    return { data, error };
  }

  async listHistory(limit = 50) {
    const { data, error } = await trueMarkets.defi.getHistory({ query: { limit } });
    return { data, error };
  }

  async listTransfers() {
    const { data, error } = await trueMarkets.gateway.listTransfers();
    return { data, error };
  }

  async getOrderStatus(orderId: string) {
    const { data } = await trueMarkets.gateway.getOrderStatus({ path: { id: orderId } });
    return data?.status;
  }
}

export const trueMarketsService = new TrueMarketsService();
