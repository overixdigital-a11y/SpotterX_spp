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

interface InviteBody {
  gym_id: string;
  role?: string;
  full_name?: string;
  username?: string;
  email?: string;
  plan_name?: string;
  pay_status?: string;
  expires_on?: string | null;
  price?: number;
  as_admin?: boolean;
  users?: Array<{
    full_name: string;
    username: string;
    email: string;
    role?: string;
    plan_name?: string;
    pay_status?: string;
    expires_on?: string | null;
    price?: number;
  }>;
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
    const body: InviteBody = await req.json();
    const { gym_id, as_admin, users } = body ?? {};
    if (!gym_id) {
      return json({ error: "Faltan campos: gym_id" }, 400);
    }

    // 3) Verificar permisos: owner del gym o admin
    let isAdmin = false;
    if (as_admin) {
      const { data: prof } = await supabase
        .from("profiles").select("is_admin").eq("id", caller.id).maybeSingle();
      isAdmin = !!prof?.is_admin;
    }
    if (!isAdmin) {
      const { data: gym, error: gymErr } = await supabase
        .from("gyms").select("id").eq("id", gym_id).eq("owner_id", caller.id).maybeSingle();
      if (gymErr || !gym) {
        return json({ error: "No sos el dueño de este gimnasio" }, 403);
      }
    }

    // 4) Determinar si es batch o single
    const isBatch = Array.isArray(users) && users.length > 0;
    const items = isBatch
      ? users.map((u) => ({
          full_name: u.full_name,
          username: u.username,
          email: u.email,
          role: u.role ?? "alumno",
          plan_name: u.plan_name,
          pay_status: u.pay_status,
          expires_on: u.expires_on,
          price: u.price,
        }))
      : [{
          full_name: body.full_name ?? "",
          username: body.username ?? "",
          email: body.email ?? "",
          role: body.role ?? "alumno",
          plan_name: body.plan_name,
          pay_status: body.pay_status,
          expires_on: body.expires_on,
          price: body.price,
        }];

    // 5) Listar usuarios existentes una sola vez
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingMap = new Map<string, string>();
    for (const u of existingUsers?.users ?? []) {
      if (u.email) existingMap.set(u.email.toLowerCase(), u.id);
    }

    // 6) Procesar cada usuario
    const results: Array<{
      ok?: boolean;
      user_id?: string;
      provisional_password?: string;
      existed?: boolean;
      email?: string;
      error?: string;
    }> = [];

    for (const item of items) {
      if (!item.full_name || !item.username || !item.email) {
        results.push({ ok: false, email: item.email, error: "Faltan campos: full_name, username, email" });
        continue;
      }
      if (item.role !== "alumno" && item.role !== "profesor") {
        results.push({ ok: false, email: item.email, error: "role debe ser alumno o profesor" });
        continue;
      }

      const password = `Spotter${randomCode(6)}!`;
      const existingUserId = existingMap.get(item.email.toLowerCase());

      let newUserId: string;
      let provisional = password;

      if (existingUserId) {
        newUserId = existingUserId;
        provisional = "";
      } else {
        const res = await supabase.auth.admin.createUser({
          email: item.email,
          password,
          email_confirm: true,
          user_metadata: { username: item.username, full_name: item.full_name, role: item.role },
        });
        if (res.error) {
          results.push({ ok: false, email: item.email, error: res.error.message });
          continue;
        }
        newUserId = res.data.user!.id;

        const { error: profErr } = await supabase
          .from("profiles")
          .upsert({
            id: newUserId,
            email: item.email,
            username: item.username,
            full_name: item.full_name,
            role: item.role,
          }, { onConflict: "id" });
        if (profErr) {
          results.push({ ok: false, email: item.email, error: profErr.message });
          continue;
        }
      }

      // Relacion staff/gym o membresia
      if (item.role === "profesor") {
        const { error: staffErr } = await supabase.from("gym_staff").upsert(
          { gym_id, user_id: newUserId, role: "profesor_invitado", authorized: true },
          { onConflict: "gym_id,user_id" }
        );
        if (staffErr) {
          results.push({ ok: false, email: item.email, error: staffErr.message });
          continue;
        }
        const { data: members } = await supabase
          .from("gym_memberships").select("user_id").eq("gym_id", gym_id).eq("status", "activa");
        if (members && members.length > 0) {
          await supabase.from("trainer_students").upsert(
            members.map((m) => ({ trainer_id: newUserId, student_id: m.user_id, source: "gym", active: true })),
            { onConflict: "trainer_id,student_id" }
          );
        }
      } else {
        const { error: memErr } = await supabase.from("gym_memberships").upsert(
          {
            gym_id,
            user_id: newUserId,
            plan_name: item.plan_name ?? "Plan inicial",
            status: "activa",
            pay_status: item.pay_status ?? "pendiente",
            expires_on: item.expires_on ?? null,
            price: typeof item.price === "number" && item.price >= 0 ? item.price : null,
          },
          { onConflict: "gym_id,user_id" }
        );
        if (memErr) {
          results.push({ ok: false, email: item.email, error: memErr.message });
          continue;
        }
        const { data: staff } = await supabase
          .from("gym_staff").select("user_id").eq("gym_id", gym_id).eq("role", "profesor_invitado");
        if (staff && staff.length > 0) {
          await supabase.from("trainer_students").upsert(
            staff.map((s) => ({ trainer_id: s.user_id, student_id: newUserId, source: "gym", active: true })),
            { onConflict: "trainer_id,student_id" }
          );
        }
      }

      results.push({
        ok: true,
        user_id: newUserId,
        provisional_password: provisional,
        existed: !!existingUserId,
        email: item.email,
      });
    }

    // Si es single, devolver resultado directo (compatibilidad con UI existente)
    if (!isBatch) {
      return json(results[0]);
    }
    return json({ ok: true, results });
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
