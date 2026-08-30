import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GymShell } from "@/components/gyms/GymShell";

export default async function GymsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <GymShell>{children}</GymShell>;
}
