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
    if (!gym_id || !role || !email) {
      return json({ error: "Faltan campos obligatorios: gym_id, role, email" }, 400);
    }
    if (role !== "alumno" && role !== "profesor") {
      return json({ error: "role debe ser alumno o profesor" }, 400);
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = username ? String(username).trim().toLowerCase() : cleanEmail.split("@")[0];
    const cleanFullName = full_name ? String(full_name).trim() : cleanUsername;

    // 3) Verificar que el caller es owner del gym
    const { data: gym, error: gymErr } = await supabase
      .from("gyms").select("id").eq("id", gym_id).eq("owner_id", caller.id).maybeSingle();
    if (gymErr || !gym) {
      return json({ error: "No sos el dueño de este gimnasio" }, 403);
    }

    // 4) Verificar si el usuario YA existe en la plataforma (por email o username)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email, username, full_name, role")
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .maybeSingle();

    if (existingProfile) {
      // 🟢 CASO A: El usuario YA está registrado en la plataforma
      const userId = existingProfile.id;

      if (role === "profesor") {
        await supabase.from("gym_staff").upsert(
          { gym_id, user_id: userId, role: "profesor_invitado", authorized: true },
          { onConflict: "gym_id,user_id" }
        );
      } else {
        // Alumno: actualizar o crear membresía
        const { data: existingMembership } = await supabase
          .from("gym_memberships")
          .select("id")
          .eq("gym_id", gym_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existingMembership) {
          await supabase.from("gym_memberships").update({
            plan_name: plan_name ?? "Plan inicial",
            status: "activa",
            pay_status: pay_status ?? "pendiente",
            expires_on: expires_on ?? null,
            price: typeof price === "number" && price >= 0 ? price : null,
          }).eq("id", existingMembership.id);
        } else {
          await supabase.from("gym_memberships").insert({
            gym_id,
            user_id: userId,
            plan_name: plan_name ?? "Plan inicial",
            status: "activa",
            pay_status: pay_status ?? "pendiente",
            expires_on: expires_on ?? null,
            price: typeof price === "number" && price >= 0 ? price : null,
          });
        }
      }

      return json({
        ok: true,
        existing: true,
        user_id: userId,
        email: existingProfile.email ?? cleanEmail,
        username: existingProfile.username ?? cleanUsername,
        full_name: existingProfile.full_name ?? cleanFullName,
        message: `El usuario @${existingProfile.username || cleanUsername} ya estaba registrado en SpotterX y se vinculó correctamente a tu gimnasio.`,
      });
    }

    // 🔴 CASO B: El usuario NO existe aún en SpotterX (se crea la cuenta)
    const password = `Spotter${randomCode(6)}!`;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { username: cleanUsername, full_name: cleanFullName, role },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    const newUserId = created.user!.id;

    // Asegurar perfil
    await supabase
      .from("profiles")
      .upsert({
        id: newUserId,
        email: cleanEmail,
        username: cleanUsername,
        full_name: cleanFullName,
        role,
      }, { onConflict: "id" });

    // Vincular al gimnasio
    if (role === "profesor") {
      await supabase.from("gym_staff").upsert(
        { gym_id, user_id: newUserId, role: "profesor_invitado", authorized: true },
        { onConflict: "gym_id,user_id" }
      );
    } else {
      await supabase.from("gym_memberships").insert({
        gym_id,
        user_id: newUserId,
        plan_name: plan_name ?? "Plan inicial",
        status: "activa",
        pay_status: pay_status ?? "pendiente",
        expires_on: expires_on ?? null,
        price: typeof price === "number" && price >= 0 ? price : null,
      });
    }

    return json({
      ok: true,
      existing: false,
      user_id: newUserId,
      provisional_password: password,
      email: cleanEmail,
      username: cleanUsername,
      full_name: cleanFullName,
      message: `Se creó la cuenta nueva para ${cleanEmail} con clave provisoria.`,
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
