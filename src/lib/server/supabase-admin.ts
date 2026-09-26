import { createClient } from "@supabase/supabase-js";

export const MISSING_SERVICE_ROLE_ERROR =
  "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor (Vercel > Settings > Environment Variables) y redesplegar.";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SPOTTERX_SERVICE_ROLE;

export function isServiceRoleConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE);
}

/**
 * Cliente de Supabase con service role (solo servidor).
 * Sin fallback a la anon key: si falta la key, falla claro en vez de
 * devolver un 403 "User not allowed" imposible de diagnosticar.
 */
export function getServiceClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error(MISSING_SERVICE_ROLE_ERROR);
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
