import { beforeEach, describe, expect, test, vi } from "vitest";

process.env.MONGODB_URI = "mongodb://test";
process.env.TEST_BUY_MAX_USD = "2";

const calls: string[] = [];
const tm = {
  defiQuoteBuy: vi.fn(),
  defiSign: vi.fn(),
  defiSubmit: vi.fn(),
};
class FakeTMError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`True Markets ${status}`);
  }
}
vi.mock("../../src/integrations/truemarkets/truemarkets.service", () => ({ trueMarketsService: tm, TrueMarketsError: FakeTMError }));

const orders: Record<string, any>[] = [];
vi.mock("../../src/models", () => ({
  Asset: { findOne: async () => ({ venue: "defi", chain: "base", address: "0xaapl", name: "Apple (Coinbase Tokenized Stock)", symbol: "AAPLC" }) },
  User: { findOneAndUpdate: async () => ({ _id: "user-1" }), findOne: () => ({ select: async () => ({ _id: "user-1" }) }) },
  Order: {
    findOne: async ({ idempotencyKey }: { idempotencyKey: string }) => orders.find((o) => o.idempotencyKey === idempotencyKey) ?? null,
    create: async (doc: Record<string, unknown>) => {
      calls.push("order-row-written");
      const o: Record<string, any> = { _id: `order-${orders.length + 1}`, status: "created", ...doc, save: async () => undefined };
      orders.push(o);
      return o;
    },
  },
}));
vi.mock("../../src/services/assets.service", () => ({
  listInvestable: async () => [{ assetKey: "base:0xaapl" }],
  toOrderTarget: (d: { address: string; chain: string }) => ({ baseAsset: d.address, chain: d.chain }),
}));
const spendGuard = vi.fn(async () => undefined);
vi.mock("../../src/services/guards", () => ({ assertCanSpend: (...a: unknown[]) => spendGuard(...(a as [])), spendRemaining: async () => "1.00" }));
const fills: unknown[] = [];
vi.mock("../../src/services/ledger.service", () => ({ recordFill: async (f: unknown) => void fills.push(f) }));

const TG = { id: 42, username: "ada" };
const KEY = "base:0xaapl";
const goodQuote = { quote_id: "q1", quote_asset: "0xusdc", qty: "1", qty_out: "0.00293218", fee: "0.002", issues: [], payloads: [{ digest: "d", payload: "p1" }, { digest: "d", payload: "p2" }] };
const goodTrade = { order_id: "tm-1", tx_hash: "0xtx", executed_qty: "0.00293", executed_vwap: "341.2", fee: "0.002" };

async function load(enabled: boolean) {
  process.env.TEST_BUY_ENABLED = String(enabled);
  vi.resetModules();
  return import("../../src/services/trade.service");
}

beforeEach(() => {
  orders.length = 0;
  fills.length = 0;
  calls.length = 0;
  spendGuard.mockReset();
  for (const fn of Object.values(tm)) fn.mockReset();
  tm.defiQuoteBuy.mockImplementation(async () => goodQuote);
  tm.defiSign.mockImplementation(async () => {
    calls.push("signed");
    return ["s1", "s2"];
  });
  tm.defiSubmit.mockImplementation(async () => {
    calls.push("submitted");
    return goodTrade;
  });
});

describe("previewBuy", () => {
  test("returns price, quantity, fee and whether live buys are on", async () => {
    const { previewBuy } = await load(false);
    const p = await previewBuy(KEY, "1.00");
    expect(p).toMatchObject({ name: "Apple", chain: "base", qtyOut: "0.00293218", fee: "0.002", enabled: false, maxUsd: "2", issues: [] });
    expect(p.price).toBe("341.04318");
    expect(tm.defiSubmit).not.toHaveBeenCalled();
  });

  test("shows what the user may still spend under the demo cap, but only when we know who is asking", async () => {
    const { previewBuy } = await load(true);
    expect((await previewBuy(KEY, "1.00", TG)).remainingUsd).toBe("1.00");
    expect((await previewBuy(KEY, "1.00")).remainingUsd).toBeNull();
  });

  test("bad amounts are refused before any quote", async () => {
    const { previewBuy } = await load(true);
    await expect(previewBuy(KEY, "50")).rejects.toThrow("limited to $2");
    expect(tm.defiQuoteBuy).not.toHaveBeenCalled();
  });
});

describe("testBuy", () => {
  test("is refused while TEST_BUY_ENABLED is off, touching nothing", async () => {
    const { testBuy } = await load(false);
    await expect(testBuy(TG, { assetKey: KEY, amount: "1.00" })).rejects.toThrow("switched off");
    expect(orders).toHaveLength(0);
    expect(tm.defiQuoteBuy).not.toHaveBeenCalled();
  });

  test("the order row is written before signing, then signed, submitted and booked as a fill", async () => {
    const { testBuy } = await load(true);
    const r = await testBuy(TG, { assetKey: KEY, amount: "1.00", minQtyOut: "0.00293218", idempotencyKey: "k1" });
    expect(calls).toEqual(["order-row-written", "signed", "submitted"]);
    expect(tm.defiSign).toHaveBeenCalledWith(goodQuote.payloads);
    expect(tm.defiSubmit).toHaveBeenCalledWith("q1", ["s1", "s2"]);
    expect(r).toMatchObject({ status: "complete", txHash: "0xtx", executedQty: "0.00293", price: "341.2" });
    expect(fills).toEqual([expect.objectContaining({ assetKey: KEY, side: "buy", quantity: "0.00293", price: "341.2", fee: "0.002", settlementAsset: "0xusdc" })]);
    expect(spendGuard).toHaveBeenCalledTimes(1);
  });

  test("replaying the same key returns the same order and never submits twice", async () => {
    const { testBuy } = await load(true);
    const first = await testBuy(TG, { assetKey: KEY, amount: "1.00", idempotencyKey: "k1" });
    orders[0]!.status = "complete";
    const again = await testBuy(TG, { assetKey: KEY, amount: "1.00", idempotencyKey: "k1" });
    expect(again.orderId).toBe(first.orderId);
    expect(tm.defiSubmit).toHaveBeenCalledTimes(1);
    expect(orders).toHaveLength(1);
  });

  test("a quote with issues (like insufficient balance) fails the order and never signs", async () => {
    tm.defiQuoteBuy.mockImplementation(async () => ({ ...goodQuote, issues: [{ message: "Insufficient balance" }] }));
    const { testBuy } = await load(true);
    await expect(testBuy(TG, { assetKey: KEY, amount: "1.00", idempotencyKey: "k2" })).rejects.toThrow("Insufficient balance");
    expect(orders[0]).toMatchObject({ status: "failed", failureReason: "Insufficient balance" });
    expect(tm.defiSign).not.toHaveBeenCalled();
    expect(tm.defiSubmit).not.toHaveBeenCalled();
  });

  test("a price move beyond 1% rejects before signing", async () => {
    tm.defiQuoteBuy.mockImplementation(async () => ({ ...goodQuote, qty_out: "0.00250" }));
    const { testBuy } = await load(true);
    await expect(testBuy(TG, { assetKey: KEY, amount: "1.00", minQtyOut: "0.00293218", idempotencyKey: "k3" })).rejects.toThrow("price moved");
    expect(orders[0]?.status).toBe("rejected_slippage");
    expect(tm.defiSign).not.toHaveBeenCalled();
  });

  test("a signing failure is a clean failure: nothing submitted", async () => {
    tm.defiSign.mockImplementation(async () => {
      throw new Error("key unreadable");
    });
    const { testBuy } = await load(true);
    await expect(testBuy(TG, { assetKey: KEY, amount: "1.00", idempotencyKey: "k4" })).rejects.toThrow("could not sign");
    expect(orders[0]?.status).toBe("failed");
    expect(tm.defiSubmit).not.toHaveBeenCalled();
  });

  test("a 4xx from True Markets on submit is a definite failure", async () => {
    tm.defiSubmit.mockImplementation(async () => {
      throw new FakeTMError(422, { message: "declined" });
    });
    const { testBuy } = await load(true);
    await expect(testBuy(TG, { assetKey: KEY, amount: "1.00", idempotencyKey: "k5" })).rejects.toThrow("declined the trade");
    expect(orders[0]?.status).toBe("failed");
  });

  test("a 5xx on submit is an unknown outcome: not retried, and a replay is refused", async () => {
    tm.defiSubmit.mockImplementation(async () => {
      throw new FakeTMError(500, {});
    });
    const { testBuy } = await load(true);
    await expect(testBuy(TG, { assetKey: KEY, amount: "1.00", idempotencyKey: "k6" })).rejects.toThrow("could not confirm");
    expect(orders[0]?.status).toBe("created");
    await expect(testBuy(TG, { assetKey: KEY, amount: "1.00", idempotencyKey: "k6" })).rejects.toThrow("has not been retried");
    expect(tm.defiSubmit).toHaveBeenCalledTimes(1);
  });

  test("no executed quantity yet means pending, with no fill invented", async () => {
    tm.defiSubmit.mockImplementation(async () => ({ ...goodTrade, executed_qty: "0", executed_vwap: "0" }));
    const { testBuy } = await load(true);
    const r = await testBuy(TG, { assetKey: KEY, amount: "1.00", idempotencyKey: "k7" });
    expect(r.status).toBe("pending");
    expect(fills).toHaveLength(0);
  });
});
