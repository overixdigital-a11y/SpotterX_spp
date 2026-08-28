import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/types";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as AppRole) ?? "alumno";

  switch (role) {
    case "profesor":
      redirect("/entrenamiento");
      break;
    case "gym":
      redirect("/gimnasio");
      break;
    default:
      redirect("/home");
  }
}
