import { beforeEach, describe, expect, test, vi } from "vitest";

process.env.MONGODB_URI = "mongodb://test";

const AAPL = "0xb200000000000000000000c2e324d24d7eecd1fb";
type O = Record<string, any>;
let orders: O[] = [];
const fills: unknown[] = [];
const history = { items: [] as unknown[] };
const listHistory = vi.fn();

vi.mock("../../src/integrations/truemarkets/truemarkets.service", () => ({ trueMarketsService: { listHistory: (...a: unknown[]) => listHistory(...a) }, TrueMarketsError: class extends Error {} }));
vi.mock("../../src/services/ledger.service", () => ({ recordFill: async (f: any) => void fills.push(f) }));
vi.mock("../../src/services/assets.service", () => ({ listInvestable: async () => [], toOrderTarget: () => ({}) }));
vi.mock("../../src/services/guards", () => ({ assertCanSpend: async () => undefined, spendRemaining: async () => null }));
vi.mock("../../src/models", () => ({
  Asset: {},
  User: {},
  Order: {
    find: (q: Record<string, any>) => {
      const rows = orders.filter((o) => (q.venue ? o.venue === q.venue : true) && (q.status ? o.status === q.status : true) && (q.historyId ? o.historyId !== undefined : true));
      return Object.assign(Promise.resolve(rows), { select: async () => rows });
    },
  },
}));

const { reconcileDefiOrders } = await import("../../src/services/trade.service");

const mkOrder = (id: string, at: string, extra: O = {}): O => ({
  _id: id, userId: "u1", venue: "defi", status: "pending", asset: `base:${AAPL}`, amount: "1.00", settlementAsset: "0xusdc", createdAt: new Date(at), save: vi.fn(async () => undefined), ...extra,
});
const hrow = (id: string, at: string, extra: O = {}) => ({ id, submittedDate: at, status: "SUCCESS", txHash: `0x${id}`, amount: "0.00293219", toAsset: AAPL, fromAsset: "0xusdc", action: "BUY", ...extra });

beforeEach(() => {
  orders = [];
  fills.length = 0;
  listHistory.mockReset();
  listHistory.mockImplementation(async () => ({ data: history, error: undefined }));
  history.items = [];
});

describe("reconcileDefiOrders", () => {
  test("does nothing, and never calls True Markets, when nothing is pending", async () => {
    orders = [mkOrder("o1", "2026-09-27T00:15:38Z", { status: "complete" })];
    expect(await reconcileDefiOrders()).toBe(0);
    expect(listHistory).not.toHaveBeenCalled();
  });

  test("a pending buy settles from the SUCCESS history row: fill recorded, tx saved, row claimed first", async () => {
    orders = [mkOrder("o1", "2026-09-27T00:15:38Z")];
    history.items = [hrow("h1", "2026-09-27T00:15:40Z")];
    expect(await reconcileDefiOrders()).toBe(1);
    expect(orders[0]).toMatchObject({ historyId: "h1", txHash: "0xh1" });
    expect(orders[0]!.save).toHaveBeenCalled();
    expect(fills).toEqual([expect.objectContaining({ orderId: "o1", side: "buy", quantity: "0.00293219", price: "341.04202", fee: "0", notional: "1.00", assetKey: `base:${AAPL}` })]);
  });

  test("running it again does not double-book: the settled order is no longer pending", async () => {
    orders = [mkOrder("o1", "2026-09-27T00:15:38Z")];
    history.items = [hrow("h1", "2026-09-27T00:15:40Z")];
    await reconcileDefiOrders();
    orders[0]!.status = "complete";
    expect(await reconcileDefiOrders()).toBe(0);
    expect(fills).toHaveLength(1);
  });

  test("a FAILED row marks the order failed and records no fill", async () => {
    orders = [mkOrder("o1", "2026-09-27T00:15:38Z")];
    history.items = [hrow("h1", "2026-09-27T00:15:40Z", { status: "FAILED" })];
    expect(await reconcileDefiOrders()).toBe(0);
    expect(orders[0]).toMatchObject({ status: "failed", failureReason: "True Markets reported the trade failed" });
    expect(fills).toHaveLength(0);
  });

  test("with no matching row yet, the order stays pending", async () => {
    orders = [mkOrder("o1", "2026-09-27T00:15:38Z")];
    expect(await reconcileDefiOrders()).toBe(0);
    expect(orders[0]!.status).toBe("pending");
  });

  test("a history outage changes nothing", async () => {
    orders = [mkOrder("o1", "2026-09-27T00:15:38Z")];
    listHistory.mockImplementation(async () => ({ data: undefined, error: { message: "down" } }));
    expect(await reconcileDefiOrders()).toBe(0);
    expect(fills).toHaveLength(0);
  });
});
