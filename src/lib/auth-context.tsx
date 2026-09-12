"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppRole, Profile } from "@/lib/types";

interface AuthState {
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
  banned: boolean;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  profile: null,
  loading: true,
  banned: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userId: null,
    profile: null,
    loading: true,
    banned: false,
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;

      if (!user) {
        setState({ userId: null, profile: null, loading: false, banned: false });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profile) {
        if ((profile as Profile).is_banned) {
          setState({ userId: null, profile: null, loading: false, banned: true });
          await supabase.auth.signOut();
          window.location.href = "/login?banned=1";
          return;
        }
        setState({ userId: user.id, profile: profile as Profile, loading: false, banned: false });
      } else {
        // Perfil aún no creado por el trigger (fallback)
        setState({
          userId: user.id,
          profile: {
            id: user.id,
            email: user.email ?? null,
            username: user.user_metadata?.username ?? "usuario",
            full_name: user.user_metadata?.full_name ?? null,
            role: (user.user_metadata?.role as AppRole) ?? "alumno",
            avatar_url: null,
            bio: null,
            location: null,
            birth_date: null,
            phone: null,
            website: null,
            social_links: null,
            is_verified: false,
            is_admin: false,
            is_banned: false,
            privacy: "publico",
            settings: null,
            disciplines: null,
            created_at: new Date().toISOString(),
          },
          loading: false,
          banned: false,
        });
      }
    };

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuthState() {
  return useContext(AuthContext);
}
