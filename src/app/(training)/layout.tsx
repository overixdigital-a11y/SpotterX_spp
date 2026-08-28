import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  return <div className="min-h-screen pb-24">{children}</div>;
}
