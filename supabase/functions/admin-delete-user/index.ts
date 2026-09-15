import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SPOTTERX_SERVICE_ROLE")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "No autorizado" }, 401);

    const {
      data: { user: caller },
      error: authErr,
    } = await supabase.auth.getUser(token);
    if (authErr || !caller) return json({ error: "Sesión inválida" }, 401);

    const { data: prof } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", caller.id)
      .maybeSingle();
    if (!prof?.is_admin) return json({ error: "No autorizado" }, 403);

    const body = await req.json();
    const { user_id } = body ?? {};
    if (!user_id) return json({ error: "Falta user_id" }, 400);

    if (user_id === caller.id) {
      return json({ error: "No podés eliminar tu propia cuenta desde el panel." }, 400);
    }

    const { data: target } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user_id)
      .maybeSingle();
    if (target?.is_admin) {
      return json({ error: "No se puede eliminar una cuenta de administrador." }, 400);
    }

    const { error } = await supabase.auth.admin.deleteUser(user_id);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
