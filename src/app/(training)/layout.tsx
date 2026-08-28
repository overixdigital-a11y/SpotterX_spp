import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrainingShell } from "@/components/training/TrainingShell";

export default async function TrainingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <TrainingShell>{children}</TrainingShell>;
}
