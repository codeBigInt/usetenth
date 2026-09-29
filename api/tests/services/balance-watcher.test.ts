import { beforeEach, describe, expect, test } from "vitest";
import { pollBalanceOnce, type BalanceWatcherDeps } from "../../src/services/balance-watcher";

function fakeDeps(balances: string[]): BalanceWatcherDeps & { watermarks: (string | null)[] } {
  const queue = [...balances];
  let stored: string | null = null;
  const watermarks: (string | null)[] = [];
  return {
    fetchBalance: async () => queue.shift()!,
    getWatermark: async () => stored,
    setWatermark: async (v) => {
      stored = v;
      watermarks.push(v);
    },
    watermarks,
  };
}

describe("pollBalanceOnce", () => {
  test("the first poll only baselines: nothing looks like a deposit yet", async () => {
    const deps = fakeDeps(["46.99"]);
    expect(await pollBalanceOnce(deps)).toBeNull();
    expect(deps.watermarks).toEqual(["46.99"]);
  });

  test("a rise since the watermark is reported as that deposit, and the watermark moves to match", async () => {
    const deps = fakeDeps(["46.99", "66.315"]);
    await pollBalanceOnce(deps); // baseline
    expect(await pollBalanceOnce(deps)).toEqual({ amount: "19.325" });
    expect(deps.watermarks).toEqual(["46.99", "66.315"]);
  });

  test("no change, or a fall from a sell settling into a different asset, is never a deposit", async () => {
    const deps = fakeDeps(["46.99", "46.99", "44.50"]);
    await pollBalanceOnce(deps);
    expect(await pollBalanceOnce(deps)).toBeNull();
    expect(await pollBalanceOnce(deps)).toBeNull();
  });

  test("the watermark advances even when nothing is reported, so a later poll measures from the true balance", async () => {
    const deps = fakeDeps(["46.99", "44.50", "50.00"]);
    await pollBalanceOnce(deps);
    await pollBalanceOnce(deps); // a fall: not a deposit, but the watermark still moves to 44.50
    expect(await pollBalanceOnce(deps)).toEqual({ amount: "5.5" });
  });

  test("a crash between reading and investing is safe: the watermark was already advanced, so the restart never re-reports it", async () => {
    let stored: string | null = "46.99";
    const deps: BalanceWatcherDeps = {
      fetchBalance: async () => "66.315",
      getWatermark: async () => stored,
      setWatermark: async (v) => {
        stored = v;
      },
    };
    const first = await pollBalanceOnce(deps);
    expect(first).toEqual({ amount: "19.325" });
    // "restart": a fresh poll reads the balance again, unaware whether the deposit was ever invested
    const replay = await pollBalanceOnce(deps);
    expect(replay).toBeNull();
  });
});
