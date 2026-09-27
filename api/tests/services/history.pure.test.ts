import { describe, expect, test } from "vitest";
import { matchSettlements, normalizeHistory, sellSettlementOf, settlementOf, type HistoryRow, type PendingDefiOrder } from "../../src/services/history.pure";

const AAPL = "0xB200000000000000000000C2E324D24D7EECD1FB";
const ORCL = "0xb0992800000000000000000000000000000000ff";
const t = (s: string) => new Date(`2026-09-27T${s}Z`);

const row = (o: Partial<HistoryRow> & { id: string }): HistoryRow => ({
  submittedAt: t("00:15:40"), status: "SUCCESS", txHash: "0xtx", amount: "0.00293219", toAsset: AAPL.toLowerCase(), fromAsset: "0xusdc", action: "BUY", ...o,
});
const order = (o: Partial<PendingDefiOrder> & { id: string }): PendingDefiOrder => ({ address: AAPL, createdAt: t("00:15:38"), amount: "1.00", ...o });

describe("normalizeHistory", () => {
  test("reads the live camelCase fields", () => {
    const r = normalizeHistory({ id: "h1", submittedDate: "2026-09-27T00:15:40Z", status: "SUCCESS", txHash: "0xabc", amount: "0.5", toAsset: "0xTOKEN", fromAsset: "0xUSDC", action: "BUY" });
    expect(r).toMatchObject({ id: "h1", status: "SUCCESS", txHash: "0xabc", amount: "0.5", toAsset: "0xTOKEN", fromAsset: "0xUSDC", action: "BUY" });
    expect(r.submittedAt?.toISOString()).toBe("2026-09-27T00:15:40.000Z");
  });

  test("still reads the SDK's snake_case spelling", () => {
    const r = normalizeHistory({ id: "h2", submitted_date: "2026-09-27T00:15:40Z", tx_hash: "0xdef", to_asset: "PYUSD", from_asset: "X", action: "DEPOSIT", status: "SUCCESS", amount: "5" });
    expect(r).toMatchObject({ txHash: "0xdef", toAsset: "PYUSD", fromAsset: "X" });
  });

  test("tolerates missing fields", () => {
    expect(normalizeHistory({})).toMatchObject({ id: "", submittedAt: null, txHash: null, toAsset: "" });
  });
});

describe("matchSettlements", () => {
  test("pairs a pending buy with the SUCCESS row for the same token, address case ignored", () => {
    const m = matchSettlements([order({ id: "o1" })], [row({ id: "h1" })]);
    expect(m).toEqual([{ orderId: "o1", row: expect.objectContaining({ id: "h1" }) }]);
  });

  test("never pairs across tokens", () => {
    expect(matchSettlements([order({ id: "o1", address: ORCL })], [row({ id: "h1" })])).toEqual([]);
  });

  test("two buys of the same token pair earliest to earliest, each row used once", () => {
    const orders = [order({ id: "o2", createdAt: t("00:20:00") }), order({ id: "o1", createdAt: t("00:15:38") })];
    const rows = [row({ id: "hB", submittedAt: t("00:20:02") }), row({ id: "hA", submittedAt: t("00:15:40") })];
    const m = matchSettlements(orders, rows);
    expect(m.map((x) => [x.orderId, x.row.id])).toEqual([["o1", "hA"], ["o2", "hB"]]);
  });

  test("ignores rows from before the order or long after it", () => {
    const orders = [order({ id: "o1" })];
    expect(matchSettlements(orders, [row({ id: "old", submittedAt: t("00:10:00") })])).toEqual([]);
    expect(matchSettlements(orders, [row({ id: "late", submittedAt: t("07:00:00") })])).toEqual([]);
  });

  test("ignores rows already claimed, and rows that are not settled buys", () => {
    const orders = [order({ id: "o1" })];
    expect(matchSettlements(orders, [row({ id: "h1" })], new Set(["h1"]))).toEqual([]);
    expect(matchSettlements(orders, [row({ id: "h2", status: "PENDING" }), row({ id: "h3", action: "SELL" })])).toEqual([]);
  });

  test("a FAILED row still pairs, so the order can be marked failed", () => {
    expect(matchSettlements([order({ id: "o1" })], [row({ id: "h1", status: "FAILED" })])[0]?.row.status).toBe("FAILED");
  });

  test("an order that already claimed a row is settled from that exact row", () => {
    const m = matchSettlements([order({ id: "o1", historyId: "hX" })], [row({ id: "hX", submittedAt: t("03:00:00") }), row({ id: "hY" })]);
    expect(m.map((x) => x.row.id)).toEqual(["hX"]);
  });
});

describe("settlementOf", () => {
  test("books the tokens actually received and the dollars paid per token", () => {
    const s = settlementOf({ amount: "1.00" }, row({ id: "h", amount: "0.00293219" }));
    expect(s.quantity).toBe("0.00293219");
    expect(s.price).toBe("341.04202"); // 1 / 0.00293219, checked independently
  });
});

describe("selling", () => {
  const sell = (o: Partial<PendingDefiOrder> & { id: string }): PendingDefiOrder => ({ ...order(o), side: "sell", amount: "0.00293216", ...o });
  const sellRow = (o: Partial<HistoryRow> & { id: string }) => row({ action: "SELL", toAsset: "0xusdc", fromAsset: AAPL.toLowerCase(), amount: "1.995", ...o });

  test("a pending sell pairs with the SELL row whose sold token is the order's, not a BUY of it", () => {
    const rows = [row({ id: "buyRow" }), sellRow({ id: "sellRow" })];
    expect(matchSettlements([sell({ id: "o1" })], rows).map((m) => m.row.id)).toEqual(["sellRow"]);
  });

  test("a buy never pairs with a SELL row", () => {
    expect(matchSettlements([order({ id: "o1" })], [sellRow({ id: "sellRow" })])).toEqual([]);
  });

  test("when the row's amount is the dollars received, that is the proceeds", () => {
    const s = sellSettlementOf({ amount: "0.00293216", quotedOut: "2.00" }, sellRow({ id: "h", amount: "1.995" }));
    expect(s).toMatchObject({ quantity: "0.00293216", proceeds: "1.995" });
    expect(s.price).toBe("680.38579");
  });

  test("when the row's amount is the tokens sold, the quoted proceeds are used instead of mistaking tokens for dollars", () => {
    const s = sellSettlementOf({ amount: "0.00293216", quotedOut: "1.995" }, sellRow({ id: "h", amount: "0.00293216" }));
    expect(s.proceeds).toBe("1.995");
  });
});
