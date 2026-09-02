import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SPOTTERX_SERVICE_ROLE ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function randomCode(n = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function POST(req: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Verificar quién llama: token en header Authorization
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !caller) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }

    // 2) Leer body
    const body = await req.json();
    const { gym_id, role, full_name, username, email, plan_name, pay_status, expires_on, price } = body ?? {};
    if (!gym_id || !role || !email) {
      return NextResponse.json({ error: "Faltan campos obligatorios: gym_id, role, email" }, { status: 400 });
    }
    if (role !== "alumno" && role !== "profesor") {
      return NextResponse.json({ error: "role debe ser alumno o profesor" }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = username ? String(username).trim().toLowerCase() : cleanEmail.split("@")[0];
    const cleanFullName = full_name ? String(full_name).trim() : cleanUsername;

    // 3) Verificar que el caller sea owner del gimnasio
    const { data: gym, error: gymErr } = await supabase
      .from("gyms").select("id").eq("id", gym_id).eq("owner_id", caller.id).maybeSingle();
    if (gymErr || !gym) {
      return NextResponse.json({ error: "No sos el dueño de este gimnasio" }, { status: 403 });
    }

    const linkUserToGym = async (userId: string) => {
      await supabase.from("profiles").upsert({
        id: userId,
        email: cleanEmail,
        username: cleanUsername,
        full_name: cleanFullName,
        role,
      }, { onConflict: "id" });

      if (role === "profesor") {
        await supabase.from("gym_staff").upsert(
          { gym_id, user_id: userId, role: "profesor_invitado", authorized: true },
          { onConflict: "gym_id,user_id" }
        );
      } else {
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
    };

    // 4) Buscar en profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email, username, full_name, role")
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .maybeSingle();

    if (existingProfile) {
      await linkUserToGym(existingProfile.id);
      return NextResponse.json({
        ok: true,
        existing: true,
        user_id: existingProfile.id,
        email: existingProfile.email ?? cleanEmail,
        username: existingProfile.username ?? cleanUsername,
        full_name: existingProfile.full_name ?? cleanFullName,
        message: `El usuario @${existingProfile.username || cleanUsername} ya estaba registrado en SpotterX y se vinculó correctamente a tu gimnasio.`,
      });
    }

    // 5) Buscar en auth.users
    const { data: userList } = await supabase.auth.admin.listUsers();
    const existingAuthUser = userList?.users?.find(
      (u) => u.email?.toLowerCase() === cleanEmail || u.user_metadata?.username?.toLowerCase() === cleanUsername
    );

    if (existingAuthUser) {
      await linkUserToGym(existingAuthUser.id);
      return NextResponse.json({
        ok: true,
        existing: true,
        user_id: existingAuthUser.id,
        email: cleanEmail,
        username: cleanUsername,
        full_name: cleanFullName,
        message: `El usuario ${cleanEmail} ya estaba registrado en Supabase Auth y fue vinculado a tu gimnasio.`,
      });
    }

    // 6) Crear cuenta nueva
    const password = `Spotter${randomCode(6)}!`;
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { username: cleanUsername, full_name: cleanFullName, role },
    });

    if (createErr) {
      if (createErr.message.toLowerCase().includes("already")) {
        const { data: retryList } = await supabase.auth.admin.listUsers();
        const retryUser = retryList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (retryUser) {
          await linkUserToGym(retryUser.id);
          return NextResponse.json({
            ok: true,
            existing: true,
            user_id: retryUser.id,
            email: cleanEmail,
            username: cleanUsername,
            full_name: cleanFullName,
            message: `El usuario ${cleanEmail} ya estaba registrado en SpotterX y se vinculó correctamente.`,
          });
        }
      }
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    const newUserId = created.user!.id;
    await linkUserToGym(newUserId);

    return NextResponse.json({
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
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
