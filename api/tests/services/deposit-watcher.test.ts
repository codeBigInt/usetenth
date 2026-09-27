import { expect, test } from "vitest";
import { historyToIncoming, pollOnce, type IncomingTransfer } from "../../src/services/deposit-watcher";

test("the live camelCase history is understood (the SDK's snake_case types are wrong)", () => {
  const live = [
    { id: "a", action: "DEPOSIT", status: "SUCCESS", amount: "10", toAsset: "PYUSD", txHash: "0x1" },
    { id: "b", action: "BUY", status: "SUCCESS", amount: "0.5", toAsset: "0xtoken" },
    { id: "c", action: "RECEIVE", status: "PENDING", amount: "3", toAsset: "PYUSD" },
  ];
  expect(historyToIncoming(live, "u-1")).toEqual([{ transferId: "a", userId: "u-1", amount: "10", asset: "PYUSD" }]);
});

test("only settled inbound history rows become deposits", () => {
  const rows = [
    { id: "a", action: "DEPOSIT", status: "SUCCESS", amount: "10", to_asset: "PYUSD" },
    { id: "b", action: "RECEIVE", status: "SUCCESS", amount: "5", to_asset: "PYUSD" },
    { id: "c", action: "DEPOSIT", status: "PENDING", amount: "7", to_asset: "PYUSD" },
    { id: "d", action: "BUY", status: "SUCCESS", amount: "3", to_asset: "AAPLC" },
    { id: "e", action: "WITHDRAW", status: "SUCCESS", amount: "2", to_asset: "PYUSD" },
  ] as const;
  const got = historyToIncoming([...rows], "u-1");
  expect(got.map((g) => g.transferId)).toEqual(["a", "b"]);
});

const transfer: IncomingTransfer = { transferId: "t-1", userId: "u-1", amount: "25.00", asset: "PYUSD" };

function fakeDeps(incoming: IncomingTransfer[]) {
  const seen = new Set<string>();
  return {
    fetchIncoming: async () => incoming,
    insertDeposit: async (t: IncomingTransfer) => {
      if (seen.has(t.transferId)) return false;
      seen.add(t.transferId);
      return true;
    },
  };
}

test("replaying the same transfer ten times emits exactly one DepositObserved", async () => {
  const deps = fakeDeps([transfer]);
  let total = 0;
  for (let i = 0; i < 10; i++) total += (await pollOnce(deps)).length;
  expect(total).toBe(1);
});

test("distinct transfers each emit once", async () => {
  const deps = fakeDeps([transfer, { ...transfer, transferId: "t-2" }]);
  expect(await pollOnce(deps)).toHaveLength(2);
  expect(await pollOnce(deps)).toHaveLength(0);
});
