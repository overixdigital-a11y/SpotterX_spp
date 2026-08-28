"use client";

import { TopBar } from "@/components/core/TopBar";
import { BottomNav } from "@/components/core/BottomNav";
import { AuthProvider } from "@/lib/auth-context";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SignOutButton() {
  const router = useRouter();
  const onLogout = async () => {
    await createClient().auth.signOut();
    router.refresh();
    router.push("/login");
  };
  return <TopBar onLogout={onLogout} />;
}

export function SocialShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SignOutButton />
      <div className="min-h-screen pb-24">{children}</div>
      <BottomNav />
    </AuthProvider>
  );
}
