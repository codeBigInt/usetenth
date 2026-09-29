import { expect, test } from "vitest";
import { pollOnce, type IncomingTransfer } from "../../src/services/deposit-watcher";

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
