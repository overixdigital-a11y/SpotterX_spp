import { createClient } from "@/lib/supabase/client";

export interface PaymentAccount {
  key: string;
  bank: string;
  account_type: string;
  number: string;
  holder: string;
  note: string;
  active: boolean;
}

export interface AdminContact {
  email: string;
  whatsapp: string;
}

export interface MarketConfig {
  allowCart: boolean;
  accounts: PaymentAccount[];
  contact: AdminContact;
  freeCount: number;
  publishPrice: number;
}

let cache: MarketConfig | null = null;
let promise: Promise<MarketConfig> | null = null;

export function resetMarketConfigCache() {
  cache = null;
}

export async function getMarketConfig(force = false): Promise<MarketConfig> {
  if (cache && !force) return cache;
  if (promise && !force) return promise;

  promise = (async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("platform_config")
      .select("key, value")
      .in("key", ["allow_cart", "payment_accounts", "admin_contact", "free_publishes", "publish_price"]);

    const map = new Map<string, unknown>();
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      map.set(row.key, row.value);
    }

    const cfg: MarketConfig = {
      allowCart: map.get("allow_cart") === true,
      accounts: Array.isArray(map.get("payment_accounts"))
        ? (map.get("payment_accounts") as PaymentAccount[])
        : [],
      contact: (map.get("admin_contact") as AdminContact) ?? { email: "", whatsapp: "" },
      freeCount: typeof map.get("free_publishes") === "number" ? (map.get("free_publishes") as number) : 3,
      publishPrice: typeof map.get("publish_price") === "number" ? (map.get("publish_price") as number) : 100,
    };

    cache = cfg;
    return cfg;
  })();

  try {
    return await promise;
  } finally {
    promise = null;
  }
}

export function activePaymentAccount(cfg: MarketConfig | null): PaymentAccount | null {
  if (!cfg || cfg.accounts.length === 0) return null;
  return cfg.accounts.find((a) => a.active) ?? cfg.accounts[0];
}