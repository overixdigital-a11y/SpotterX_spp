"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/types";

const homeByRole: Record<AppRole, string> = {
  alumno: "/home",
  profesor: "/entrenamiento",
  gym: "/gimnasio",
};

export function useAuth() {
  const supabase = createClient();
  const router = useRouter();

  const homeFor = async (userId: string): Promise<string> => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = (profile?.role as AppRole) ?? "alumno";
    return homeByRole[role];
  };

  const signIn = async (email: string, password: string, next?: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    router.refresh();
    router.push(next ?? (await homeFor(data.user.id)));
  };

  const signUp = async (opts: {
    email: string;
    password: string;
    username: string;
    fullName: string;
    role: AppRole;
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email: opts.email,
      password: opts.password,
      options: {
        data: {
          username: opts.username,
          full_name: opts.fullName,
          role: opts.role,
        },
      },
    });
    if (error) throw error;
    if (data.session && data.user) {
      router.refresh();
      const home = await homeFor(data.user.id);
      router.push(home);
    }
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  };

  return { signIn, signUp, signOut };
}
