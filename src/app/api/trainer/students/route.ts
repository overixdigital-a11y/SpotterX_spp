import { NextResponse } from "next/server";
import {
  getServiceClient,
  isServiceRoleConfigured,
  MISSING_SERVICE_ROLE_ERROR,
} from "@/lib/server/supabase-admin";

function randomCode(n = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

async function getCaller(supabase: ReturnType<typeof getServiceClient>, token: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return { error: "Sesión inválida", status: 401 } as const;
  return { caller: user } as const;
}

export async function POST(req: Request) {
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: MISSING_SERVICE_ROLE_ERROR }, { status: 500 });
  }

  try {
    const supabase = getServiceClient();

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const callerResult = await getCaller(supabase, token);
    if ("error" in callerResult) {
      return NextResponse.json({ error: callerResult.error }, { status: callerResult.status });
    }
    const caller = callerResult.caller;

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("id", caller.id)
      .maybeSingle();

    if (callerProfile?.role !== "profesor" && !callerProfile?.is_admin) {
      return NextResponse.json(
        { error: "Solo los profesores pueden crear alumnos propios" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const fullName = String(body?.full_name ?? "").trim();
    const emailRaw = String(body?.email ?? "").trim().toLowerCase();

    if (fullName.length < 3) {
      return NextResponse.json(
        { error: "Escribí el nombre y apellido del alumno" },
        { status: 400 }
      );
    }
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return NextResponse.json({ error: "El email no es válido" }, { status: 400 });
    }

    const { firstName, lastName } = splitName(fullName);
    const email = emailRaw || `pendiente-${randomCode(8).toLowerCase()}@spotterx.app`;
    const isPendingEmail = !emailRaw;

    // Username unico a partir del nombre
    const base = slugify(fullName) || "alumno";
    let username = base;
    for (let i = 0; i < 6; i++) {
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (!taken) break;
      username = `${base}_${randomCode(4).toLowerCase()}`;
    }

    // Si ya existe una cuenta con ese email, se vincula en vez de duplicar
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email, username, full_name")
      .eq("email", email)
      .maybeSingle();

    const linkStudent = async (studentId: string) => {
      const { error: linkError } = await supabase.from("trainer_students").upsert(
        {
          trainer_id: caller.id,
          student_id: studentId,
          source: "propio",
          active: true,
        },
        { onConflict: "trainer_id,student_id" }
      );
      if (linkError) throw new Error(linkError.message);
    };

    if (existingProfile) {
      await linkStudent(existingProfile.id);
      return NextResponse.json({
        ok: true,
        existing: true,
        user_id: existingProfile.id,
        username: existingProfile.username,
        full_name: existingProfile.full_name,
        message: `@${existingProfile.username} ya tenía cuenta y quedó vinculado a tu lista.`,
      });
    }

    const password = `Spotter${randomCode(6)}!`;
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: fullName, role: "alumno" },
    });

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    const newUserId = created.user!.id;

    // El trigger handle_new_user suele crear el profile; si no existe, se insureta
    const { data: createdProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", newUserId)
      .maybeSingle();

    if (!createdProfile) {
      await supabase.from("profiles").upsert(
        {
          id: newUserId,
          email,
          username,
          full_name: fullName,
          role: "alumno",
        },
        { onConflict: "id" }
      );
    } else {
      await supabase
        .from("profiles")
        .update({ email, username, full_name: fullName, role: "alumno" })
        .eq("id", newUserId);
    }

    await linkStudent(newUserId);

    return NextResponse.json({
      ok: true,
      existing: false,
      user_id: newUserId,
      username,
      full_name: fullName,
      provisional_password: password,
      email,
      pending_email: isPendingEmail,
      first_name: firstName,
      last_name: lastName,
      message: isPendingEmail
        ? "Alumno creado. Podés copiarle las credenciales y más adelante cambiar su email desde Configuración."
        : "Alumno creado con su email.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}
