import { Client } from "@truemarkets/sdk";

// The SDK reads TM_ENV / TM_KEY_FILE and handles JWT signing + refresh.
export const trueMarkets = new Client();
