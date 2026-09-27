import { beforeEach, describe, expect, test, vi } from "vitest";

process.env.MONGODB_URI = "mongodb://test";

const calls: string[] = [];
const tm = { defiQuoteSell: vi.fn(), defiSign: vi.fn(), defiSubmit: vi.fn(), listBalances: vi.fn() };
class FakeTMError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`True Markets ${status}`);
  }
}
vi.mock("../../src/integrations/truemarkets/truemarkets.service", () => ({ trueMarketsService: tm, TrueMarketsError: FakeTMError }));

const orders: Record<string, any>[] = [];
let position: { quantity: string } | null = { quantity: "0.00293219" };
vi.mock("../../src/models", () => ({
  Asset: {
    findOne: (q: { assetKey: string }) => {
      const doc = q.assetKey.startsWith("base:0x8335") ? { symbol: "USDC" } : { venue: "defi", chain: "base", address: "0xB200aapl", name: "Apple (Coinbase Tokenized Stock)", symbol: "AAPLC" };
      return Object.assign(Promise.resolve(doc), { select: async () => doc });
    },
  },
  User: { findOne: () => ({ select: async () => ({ _id: "user-1" }) }) },
  Position: { findOne: async () => position },
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
  listInvestable: async () => [],
  toOrderTarget: (d: { address: string; chain: string }) => ({ baseAsset: d.address, chain: d.chain }),
  assetKeyFor: (a: { chain: string; address: string }) => `${a.chain}:${a.address.toLowerCase()}`,
}));
vi.mock("../../src/services/guards", () => ({ assertCanSpend: async () => undefined, spendRemaining: async () => null }));
const fills: any[] = [];
vi.mock("../../src/services/ledger.service", () => ({ recordFill: async (f: unknown) => void fills.push(f) }));

const TG = { id: 42, username: "ada" };
const KEY = "base:0xb200aapl";
const quote = { quote_id: "q1", quote_asset: "0x8335usdc", qty: "0.00293216", qty_out: "1.995", fee: "0.004", issues: [], payloads: [{ digest: "d", payload: "p" }] };

async function load(enabled: boolean) {
  process.env.TEST_BUY_ENABLED = String(enabled);
  vi.resetModules();
  return import("../../src/services/trade.service");
}

beforeEach(() => {
  orders.length = 0;
  fills.length = 0;
  calls.length = 0;
  position = { quantity: "0.00293219" };
  for (const fn of Object.values(tm)) fn.mockReset();
  tm.listBalances.mockImplementation(async () => ({ data: { data: [{ address: "0xb200aapl", available: "0.00293216" }] } }));
  tm.defiQuoteSell.mockImplementation(async () => quote);
  tm.defiSign.mockImplementation(async () => {
    calls.push("signed");
    return ["s1"];
  });
  tm.defiSubmit.mockImplementation(async () => {
    calls.push("submitted");
    return { order_id: "tm-1", tx_hash: "0xtx", executed_qty: "0.00293216", executed_vwap: "680.5", fee: "0.004" };
  });
});

describe("sellableQty", () => {
  test("is what the user bought, capped by what the wallet holds (never more than either)", async () => {
    const { sellableQty } = await load(true);
    expect(await sellableQty("u", KEY, "0xB200aapl")).toBe("0.00293216"); // wallet holds less than the ledger says
    position = { quantity: "0.001" };
    expect(await sellableQty("u", KEY, "0xB200aapl")).toBe("0.001"); // the user only bought part of what the wallet holds
  });

  test("is zero when the user bought none of it, even if the shared wallet holds plenty", async () => {
    const { sellableQty } = await load(true);
    position = null;
    expect(await sellableQty("u", KEY, "0xB200aapl")).toBe("0");
  });
});

describe("previewSell", () => {
  test("quotes selling everything they may sell, and names the asset they will receive", async () => {
    const { previewSell } = await load(false);
    const p = await previewSell(KEY, TG);
    expect(tm.defiQuoteSell).toHaveBeenCalledWith({ baseAsset: "0xB200aapl", chain: "base" }, "0.00293216");
    expect(p).toMatchObject({ name: "Apple", qty: "0.00293216", receive: "1.995", fee: "0.004", receiveAsset: "USDC", enabled: false, issues: [] });
  });

  test("refuses a stock the user does not own, before asking True Markets anything", async () => {
    position = null;
    const { previewSell } = await load(true);
    await expect(previewSell(KEY, TG)).rejects.toThrow("only sell what you bought yourself");
    expect(tm.defiQuoteSell).not.toHaveBeenCalled();
  });

  test("passes True Markets' minimum-size complaint through so the UI can explain it", async () => {
    tm.defiQuoteSell.mockImplementation(async () => ({ ...quote, qty_out: "0.995", issues: [{ message: "Trade size below minimum of $1.00" }] }));
    const { previewSell } = await load(true);
    expect((await previewSell(KEY, TG)).issues).toEqual(["Trade size below minimum of $1.00"]);
  });
});

describe("testSell", () => {
  test("is refused while live trades are switched off, touching nothing", async () => {
    const { testSell } = await load(false);
    await expect(testSell(TG, { assetKey: KEY })).rejects.toThrow("switched off");
    expect(orders).toHaveLength(0);
  });

  test("row first, then sign and submit, then the sale is booked with its dollars received", async () => {
    const { testSell } = await load(true);
    const r = await testSell(TG, { assetKey: KEY, minReceive: "1.995", idempotencyKey: "sell-key-1" });
    expect(calls).toEqual(["order-row-written", "signed", "submitted"]);
    expect(orders[0]).toMatchObject({ side: "sell", amount: "0.00293216", amountUnit: "base", quotedOut: "1.995" });
    expect(r.status).toBe("complete");
    expect(fills).toEqual([expect.objectContaining({ side: "sell", quantity: "0.00293216", assetKey: KEY, fee: "0" })]);
    expect(Number(fills[0].notional)).toBeCloseTo(0.00293216 * 680.5, 6);
  });

  test("a quote that fails True Markets' minimum fails the order and never signs", async () => {
    tm.defiQuoteSell.mockImplementation(async () => ({ ...quote, issues: [{ message: "Trade size below minimum of $1.00" }] }));
    const { testSell } = await load(true);
    await expect(testSell(TG, { assetKey: KEY, idempotencyKey: "sell-key-2" })).rejects.toThrow("below minimum");
    expect(orders[0]).toMatchObject({ status: "failed" });
    expect(tm.defiSign).not.toHaveBeenCalled();
  });

  test("getting more than 1% less than quoted rejects the sale before signing", async () => {
    tm.defiQuoteSell.mockImplementation(async () => ({ ...quote, qty_out: "1.90" }));
    const { testSell } = await load(true);
    await expect(testSell(TG, { assetKey: KEY, minReceive: "1.995", idempotencyKey: "sell-key-3" })).rejects.toThrow("price moved");
    expect(tm.defiSign).not.toHaveBeenCalled();
  });

  test("replaying a completed sale returns it and never submits twice", async () => {
    const { testSell } = await load(true);
    await testSell(TG, { assetKey: KEY, idempotencyKey: "sell-key-4" });
    orders[0]!.status = "complete";
    await testSell(TG, { assetKey: KEY, idempotencyKey: "sell-key-4" });
    expect(tm.defiSubmit).toHaveBeenCalledTimes(1);
  });

  test("a 5xx on submit is an unknown outcome: not retried and a replay is refused", async () => {
    tm.defiSubmit.mockImplementation(async (..._a: unknown[]) => {
      throw new FakeTMError(500, {});
    });
    const { testSell } = await load(true);
    await expect(testSell(TG, { assetKey: KEY, idempotencyKey: "sell-key-5" })).rejects.toThrow("could not confirm");
    await expect(testSell(TG, { assetKey: KEY, idempotencyKey: "sell-key-5" })).rejects.toThrow("has not been retried");
    expect(tm.defiSubmit).toHaveBeenCalledTimes(1);
  });

  test("no executed quantity yet means pending, and no fill is invented", async () => {
    tm.defiSubmit.mockImplementation(async () => ({ order_id: "tm-1", tx_hash: "0xtx", executed_qty: "0", executed_vwap: "0" }));
    const { testSell } = await load(true);
    expect((await testSell(TG, { assetKey: KEY, idempotencyKey: "sell-key-6" })).status).toBe("pending");
    expect(fills).toHaveLength(0);
  });
});
