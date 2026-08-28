"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/types";

export function useAuth() {
  const supabase = createClient();
  const router = useRouter();

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    router.refresh();
    router.push("/home");
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
    if (data.session) {
      router.refresh();
      router.push("/home");
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
