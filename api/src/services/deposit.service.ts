import { env } from "../config/env";
import { accountRequest, AccountApiError } from "../integrations/truemarkets/account";
import { getWalletAddress } from "../integrations/truemarkets/wallet";
import { Asset } from "../models";
import AppError from "./error";
import { mergeNetworks, networkName, type DepositNetwork, type RawAddress } from "./deposit.pure";

export interface DepositView {
  asset: string;
  networks: DepositNetwork[];
  /** True Markets only creates new deposit addresses and bank details for a verified account. */
  canCreate: boolean;
}

const asData = <T>(body: unknown): T[] => ((body as { data?: T[] } | null)?.data ?? []) as T[];

async function supportedNetworks(): Promise<{ network: string; compatible: string[] }[]> {
  const doc = await Asset.findOne({ assetKey: `cefi:${env.TM_SETTLEMENT_ASSET.toUpperCase()}` }).select("networks");
  const nets = (doc?.networks ?? []).map((n) => ({ network: n.network as string, compatible: (n.compatible ?? []) as string[] }));
  if (nets.length === 0) throw new AppError(503, "Deposit networks are not loaded yet. Try again in a minute.");
  return nets;
}

const listAddresses = async () => asData<RawAddress>(await accountRequest("GET", "/deposits/addresses"));

const isVerified = async () => {
  const status = await accountRequest<{ paxos_verified?: boolean }>("GET", "/kyc/status").catch(() => null);
  return status?.paxos_verified === true;
};

export async function depositOptions(): Promise<DepositView> {
  const [supported, addresses, wallet, canCreate] = await Promise.all([supportedNetworks(), listAddresses(), getWalletAddress().catch(() => null), isVerified()]);
  return { asset: env.TM_SETTLEMENT_ASSET, networks: mergeNetworks(supported, addresses, wallet), canCreate };
}

/** Returns the network's address, creating one only when the asset accepts the network and the account may. */
export async function ensureDepositAddress(network: string): Promise<DepositView> {
  const view = await depositOptions();
  const target = view.networks.find((n) => n.network === network);
  if (!target) throw new AppError(400, `${view.asset} cannot be deposited on ${network}`);
  if (target.address) return view;
  if (!view.canCreate) {
    const name = networkName(network);
    throw new AppError(409, `${/^[aeiou]/i.test(name) ? "An" : "A"} ${name} deposit address needs a verified account, which this account does not have yet.`);
  }
  try {
    await accountRequest("POST", "/deposits/addresses", { network });
  } catch (error) {
    if (!(error instanceof AccountApiError && error.status === 409)) throw error;
  }
  return depositOptions();
}

/** The default network's address (created on first use if allowed), plus every other option. */
export async function defaultDeposit(): Promise<DepositView & { defaultNetwork: string }> {
  const first = await depositOptions();
  const preferred = first.networks.find((n) => n.network === env.DEPOSIT_DEFAULT_NETWORK && n.address);
  const anyWithAddress = first.networks.find((n) => n.address);
  const defaultNetwork = (preferred ?? anyWithAddress ?? first.networks.find((n) => n.network === env.DEPOSIT_DEFAULT_NETWORK) ?? first.networks[0]!).network;
  return { ...(await ensureDepositAddress(defaultNetwork)), defaultNetwork };
}

export const listWireInstructions = async () => asData<Record<string, unknown>>(await accountRequest("GET", "/deposits/wire-instructions"));

export async function createWireInstructions() {
  if (!(await isVerified())) throw new AppError(409, "Bank transfers need a verified account, which this account does not have yet.");
  try {
    await accountRequest("POST", "/deposits/wire-instructions", {});
  } catch (error) {
    if (!(error instanceof AccountApiError)) throw error;
    if (error.status !== 409) {
      const message = (error.body as { message?: string } | null)?.message ?? "True Markets could not set up bank transfers yet";
      throw new AppError(error.status >= 500 ? 502 : 400, message);
    }
  }
  return listWireInstructions();
}
