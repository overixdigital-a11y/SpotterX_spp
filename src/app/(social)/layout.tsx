import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SocialShell } from "@/components/social/SocialShell";

export default async function SocialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <SocialShell>{children}</SocialShell>;
}
