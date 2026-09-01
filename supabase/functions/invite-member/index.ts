import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SPOTTERX_SERVICE_ROLE")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function randomCode(n = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Verificar quien llama: debe estar autenticado
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return json({ error: "No autorizado" }, 401);
    }
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !caller) {
      return json({ error: "Sesión inválida" }, 401);
    }

    // 2) Leer body
    const body = await req.json();
    const { gym_id, role, full_name, username, email, plan_name, pay_status, expires_on, price } = body ?? {};
    if (!gym_id || !role || !full_name || !username || !email) {
      return json({ error: "Faltan campos: gym_id, role, full_name, username, email" }, 400);
    }
    if (role !== "alumno" && role !== "profesor") {
      return json({ error: "role debe ser alumno o profesor" }, 400);
    }

    // 3) Verificar que el caller es owner del gym
    const { data: gym, error: gymErr } = await supabase
      .from("gyms").select("id").eq("id", gym_id).eq("owner_id", caller.id).maybeSingle();
    if (gymErr || !gym) {
      return json({ error: "No sos el dueño de este gimnasio" }, 403);
    }

    // 4) Contraseña provisional
    const password = `Spotter${randomCode(6)}!`;

    // 5) Crear el usuario
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name, role },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    // 6) Asegurar perfil (por si el trigger no corrio con admin)
    const { error: profErr } = await supabase
      .from("profiles")
      .upsert({
        id: created.user!.id,
        email,
        username,
        full_name,
        role,
      }, { onConflict: "id" });
    if (profErr) return json({ error: profErr.message }, 500);

    // 7) Relacion staff/gym o membresia
    if (role === "profesor") {
      await supabase.from("gym_staff").upsert(
        { gym_id, user_id: created.user!.id, role: "profesor_invitado", authorized: true },
        { onConflict: "gym_id,user_id" }
      );
    } else {
      await supabase.from("gym_memberships").insert({
        gym_id,
        user_id: created.user!.id,
        plan_name: plan_name ?? "Plan inicial",
        status: "activa",
        pay_status: pay_status ?? "pendiente",
        expires_on: expires_on ?? null,
        price: typeof price === "number" && price >= 0 ? price : null,
      });
    }

    return json({
      ok: true,
      user_id: created.user!.id,
      provisional_password: password,
      email,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
