import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProfileLite {
  full_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url?: string | null;
}

export function displayName(p: ProfileLite | null | undefined): string {
  return p?.full_name ?? p?.email ?? p?.username ?? "Sin nombre";
}

export async function fetchProfiles(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, ProfileLite>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, ProfileLite>();
  if (unique.length === 0) return map;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, username, email, avatar_url")
    .in("id", unique);

  for (const row of data ?? []) {
    map.set(row.id, {
      full_name: row.full_name ?? null,
      username: row.username ?? null,
      email: row.email ?? null,
      avatar_url: row.avatar_url ?? null,
    });
  }
  return map;
}
