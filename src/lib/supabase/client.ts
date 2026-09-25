import { createBrowserClient } from "@supabase/ssr";

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type Client = ReturnType<typeof makeClient>;

let client: Client | null = null;

export function createClient() {
  if (!client) {
    client = makeClient();
  }
  return client;
}
