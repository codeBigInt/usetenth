import type { gateway } from "@truemarkets/sdk";

// The SDK's AssetItem type lacks fields the live /assets response returns.
export interface RawAssetItem extends gateway.AssetItem {
  asset_class?: "crypto" | "stock";
  type?: "spot" | "perp";
}

export interface DepositAddressCreationResponse {
  data: {
    id: string;
    network: string;
    address: string;
    compatible_networks: string[]
    created_at: string;
  }[],
  pagination: {
    next_cursor: string,
    limit: number
  }
}

export interface TrueMarketAuthPayload {
  key_id: string;
  timestamp: number;
}

export interface TrueMarketAuthResponse {
  access_token: string
}

export interface DepositAddressCreationRequestData {
  network: string
}


export interface TrueMarketKYCPrefillRequestData {
  flow_type: string;
  phone_number: string;
  ssn: string;
}

export interface TrueMarketKYCPrefillResponse {
  session_id: string;
  auth_token: string;
}

export interface CreateAddressResponse {
  id: string;
  network: string;
  address: string;
  compatible_networks: string[];
  created_at: string;
}


export interface WithdrawSuccessResponse {
  id: string;
  status: string;
  venue: string;
  asset_id: string;
  asset_symbol: string;
  chain: string;
  network: string;
  to: string;
  qty: string;
  qty_unit: string;
  sent: string;
  fee: string;
  received: string;
  tx_hash: string;
  payloads: {
    digest: string;
    payload: string;
  }[];
  created_at: string;
  updated_at: string;
}

export interface WithdrawalRequestData {
  asset_id: string;
  qty: string;
  qty_unit: string;
  to: string;
  network: string;
}

export interface PendingWithdrawalExecutionRequestData {
  signatures: string[];
  auth_type: string;
}

export interface ErrorResponse {
  messgae: string;
  code: number;
}
