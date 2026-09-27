import { beforeEach, describe, expect, test, vi } from "vitest";
import { joinNames, mergeNetworks, networkName, walletNetwork } from "../../src/services/deposit.pure";

process.env.MONGODB_URI = "mongodb://test";
process.env.TM_SETTLEMENT_ASSET = "PYUSD";

const request = vi.fn();
class FakeAccountApiError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`account ${status}`);
  }
}
vi.mock("../../src/integrations/truemarkets/account", () => ({ accountRequest: (...a: unknown[]) => request(...a), AccountApiError: FakeAccountApiError }));
let wallet: string | null = null;
vi.mock("../../src/integrations/truemarkets/wallet", () => ({ getWalletAddress: async () => wallet }));
vi.mock("../../src/models", () => ({
  Asset: { findOne: () => ({ select: async () => ({ networks: [{ network: "solana", compatible: [] }, { network: "ethereum", compatible: ["base", "arbitrum_one"] }] }) }) },
}));

const created = (network: string, address: string) => ({ data: [{ network, address, compatible_networks: [] }] });

describe("deposit.pure", () => {
  test("names networks readably and joins lists", () => {
    expect(networkName("arbitrum_one")).toBe("Arbitrum");
    expect(networkName("some_new_chain")).toBe("Some new chain");
    expect(joinNames(["base"])).toBe("Base");
    expect(joinNames(["base", "xlayer", "ink"])).toBe("Base, X Layer and Ink");
  });

  test("only supported networks appear, each with its address when one exists", () => {
    const merged = mergeNetworks(
      [{ network: "solana", compatible: [] }, { network: "ethereum", compatible: ["base"] }],
      [{ network: "solana", address: "S1" }, { network: "bitcoin", address: "B1" }],
    );
    expect(merged).toEqual([
      { network: "solana", compatible: [], address: "S1", source: "deposit" },
      { network: "ethereum", compatible: ["base"], address: null, source: null },
    ]);
  });

  test("with no deposit address, the account's own wallet fills its own network only", () => {
    const supported = [{ network: "solana", compatible: [] }, { network: "ethereum", compatible: ["base"] }];
    expect(mergeNetworks(supported, [], "GWwFexampleSolanaWalletAddress")).toEqual([
      { network: "solana", compatible: [], address: "GWwFexampleSolanaWalletAddress", source: "wallet" },
      { network: "ethereum", compatible: ["base"], address: null, source: null },
    ]);
    expect(mergeNetworks(supported, [], "0xAbC")[1]).toMatchObject({ network: "ethereum", address: "0xAbC", source: "wallet" });
    expect(walletNetwork("0xabc")).toBe("ethereum");
  });

  test("a real deposit address wins over the wallet", () => {
    const merged = mergeNetworks([{ network: "solana", compatible: [] }], [{ network: "solana", address: "REAL" }], "WALLET");
    expect(merged[0]).toMatchObject({ address: "REAL", source: "deposit" });
  });
});

describe("deposit.service", () => {
  beforeEach(() => {
    request.mockReset();
    wallet = null;
  });

  const verified = (extra: (method: string, path: string) => unknown = () => undefined) => async (method: string, path: string) => {
    if (path === "/kyc/status") return { paxos_verified: true };
    return extra(method, path) ?? { data: [] };
  };

  test("refuses a network the asset does not accept, without creating anything", async () => {
    request.mockImplementation(verified());
    const { ensureDepositAddress } = await import("../../src/services/deposit.service");
    await expect(ensureDepositAddress("bitcoin")).rejects.toThrow("cannot be deposited on bitcoin");
    expect(request.mock.calls.every(([method]) => method === "GET")).toBe(true);
  });

  test("an unverified account gets its wallet as the Solana address, and no doomed create is attempted", async () => {
    wallet = "GWwFexampleSolanaWalletAddress";
    request.mockImplementation(async (_m: string, path: string) => (path === "/kyc/status" ? { paxos_verified: false } : { data: [] }));
    const { ensureDepositAddress, defaultDeposit } = await import("../../src/services/deposit.service");
    const view = await ensureDepositAddress("solana");
    expect(view.canCreate).toBe(false);
    expect(view.networks.find((n) => n.network === "solana")).toMatchObject({ address: wallet, source: "wallet" });
    expect((await defaultDeposit()).defaultNetwork).toBe("solana");
    expect(request.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });

  test("an unverified account cannot create another network's address, and is told why", async () => {
    request.mockImplementation(async (_m: string, path: string) => (path === "/kyc/status" ? { paxos_verified: false } : { data: [] }));
    const { ensureDepositAddress } = await import("../../src/services/deposit.service");
    const caught = await ensureDepositAddress("ethereum").catch((e: unknown) => e);
    expect(caught).toMatchObject({ statusCode: 409 });
    expect((caught as Error).message).toContain("needs a verified account");
    expect(request.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });

  test("bank transfer setup is refused without verification, before calling True Markets", async () => {
    request.mockImplementation(async (_m: string, path: string) => (path === "/kyc/status" ? { paxos_verified: false } : { data: [] }));
    const { createWireInstructions } = await import("../../src/services/deposit.service");
    const caught = await createWireInstructions().catch((e: unknown) => e);
    expect(caught).toMatchObject({ statusCode: 409 });
    expect(request.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });

  test("returns an existing address without creating another", async () => {
    request.mockImplementation(verified(() => created("solana", "S1")));
    const { ensureDepositAddress } = await import("../../src/services/deposit.service");
    const view = await ensureDepositAddress("solana");
    expect(view.networks.find((n) => n.network === "solana")?.address).toBe("S1");
    expect(request.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });

  test("creates the address on first use, then reads it back", async () => {
    let made = false;
    request.mockImplementation(
      verified((method) => {
        if (method === "POST") {
          made = true;
          return {};
        }
        return made ? created("solana", "S1") : undefined;
      }),
    );
    const { ensureDepositAddress } = await import("../../src/services/deposit.service");
    const view = await ensureDepositAddress("solana");
    expect(request).toHaveBeenCalledWith("POST", "/deposits/addresses", { network: "solana" });
    expect(view.networks.find((n) => n.network === "solana")?.address).toBe("S1");
  });

  test("a 409 (already exists) is not an error", async () => {
    let calls = 0;
    request.mockImplementation(
      verified((method, path) => {
        if (method === "POST") throw new FakeAccountApiError(409, {});
        return path === "/deposits/addresses" && ++calls > 1 ? created("solana", "S1") : undefined;
      }),
    );
    const { ensureDepositAddress } = await import("../../src/services/deposit.service");
    await expect(ensureDepositAddress("solana")).resolves.toBeDefined();
  });

  test("any other Account API failure surfaces", async () => {
    request.mockImplementation(
      verified((method) => {
        if (method === "POST") throw new FakeAccountApiError(500, {});
        return undefined;
      }),
    );
    const { ensureDepositAddress } = await import("../../src/services/deposit.service");
    await expect(ensureDepositAddress("solana")).rejects.toThrow("account 500");
  });

  test("bank transfer setup surfaces True Markets' own reason", async () => {
    const { createWireInstructions } = await import("../../src/services/deposit.service");
    request.mockImplementation(
      verified((method) => {
        if (method === "POST") throw new FakeAccountApiError(422, { message: "KYC required" });
        return undefined;
      }),
    );
    const caught = await createWireInstructions().catch((e: unknown) => e);
    expect(caught).toMatchObject({ message: "KYC required", statusCode: 400 });
  });
});
