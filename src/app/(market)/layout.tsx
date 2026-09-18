import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketShell } from "@/components/market/MarketShell";

export default async function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <MarketShell>{children}</MarketShell>;
}