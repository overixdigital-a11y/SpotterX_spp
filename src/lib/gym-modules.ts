import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthState } from "@/lib/auth-context";

export type GymModule = "feed" | "spotter_shop" | "entrenamiento" | "catalogo";

export interface GymModules {
  feed: boolean;
  spotter_shop: boolean;
  entrenamiento: boolean;
  catalogo: boolean;
}

export const ALL_GYM_MODULES: { key: GymModule; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "spotter_shop", label: "SpotterShop" },
  { key: "entrenamiento", label: "Mi Entrenamiento" },
  { key: "catalogo", label: "Catálogo" },
];

export const DEFAULT_GYM_MODULES: GymModules = {
  feed: true,
  spotter_shop: true,
  entrenamiento: true,
  catalogo: true,
};

const cache = new Map<string, GymModules>();
const promiseCache = new Map<string, Promise<GymModules>>();

export function resetGymModulesCache() {
  cache.clear();
  promiseCache.clear();
}

export async function getGymModules(gymId: string, force = false): Promise<GymModules> {
  const cached = cache.get(gymId);
  if (cached && !force) return cached;
  const inFlight = promiseCache.get(gymId);
  if (inFlight && !force) return inFlight;

  const p = (async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("gym_module_settings")
      .select("module, enabled")
      .eq("gym_id", gymId);

    const modules: GymModules = { ...DEFAULT_GYM_MODULES };
    for (const row of (data ?? []) as { module: GymModule; enabled: boolean }[]) {
      if (row.module in modules) {
        modules[row.module] = row.enabled;
      }
    }
    cache.set(gymId, modules);
    return modules;
  })();

  promiseCache.set(gymId, p);
  try {
    return await p;
  } finally {
    promiseCache.delete(gymId);
  }
}

export interface UserGym {
  id: string;
  name: string | null;
}

let gymCache: Map<string, UserGym | null> = new Map();

export function resetUserGymCache() {
  gymCache = new Map();
}

export async function getUserGym(userId: string, force = false): Promise<UserGym | null> {
  if (gymCache.has(userId) && !force) return gymCache.get(userId) ?? null;
  const supabase = createClient();
  const { data } = await supabase
    .from("gyms")
    .select("id, name")
    .eq("owner_id", userId)
    .maybeSingle();
  const gym: UserGym | null = data ? { id: data.id, name: data.name } : null;
  gymCache.set(userId, gym);
  return gym;
}

export interface GymModuleState {
  gym: UserGym | null;
  modules: GymModules | null;
  loading: boolean;
}

export function useGymModules(userId: string | null): GymModuleState {
  const [state, setState] = useState<GymModuleState>({
    gym: null,
    modules: null,
    loading: !!userId,
  });

  useEffect(() => {
    if (!userId) {
      const t = setTimeout(() => {
        setState({ gym: null, modules: null, loading: false });
      }, 0);
      return () => clearTimeout(t);
    }
    let active = true;
    const run = () => {
      setState((s) => ({ ...s, loading: true }));
      void (async () => {
        const gym = await getUserGym(userId);
        if (!active) return;
        if (!gym) {
          setState({ gym: null, modules: null, loading: false });
          return;
        }
        const modules = await getGymModules(gym.id);
        if (active) setState({ gym, modules, loading: false });
      })();
    };
    const t = setTimeout(run, 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [userId]);

  return state;
}

export function useGymModuleAccess(module: GymModule): { checked: boolean; blocked: boolean } {
  const { userId } = useAuthState();
  const { gym, modules, loading } = useGymModules(userId);
  if (loading) return { checked: false, blocked: false };
  if (!gym || !modules) return { checked: true, blocked: false };
  return { checked: true, blocked: !modules[module] };
}

export function useModuleGuard(module: GymModule): { busy: boolean } {
  const router = useRouter();
  const { checked, blocked } = useGymModuleAccess(module);
  useEffect(() => {
    if (checked && blocked) {
      router.replace("/gimnasio");
    }
  }, [checked, blocked, router]);
  return { busy: !checked || blocked };
}

const blockedOwnersCache = new Map<GymModule, string[]>();

export function resetBlockedOwnersCache() {
  blockedOwnersCache.clear();
}

export async function getBlockedOwners(module: GymModule, force = false): Promise<string[]> {
  const cached = blockedOwnersCache.get(module);
  if (cached && !force) return cached;
  const supabase = createClient();
  const { data } = await supabase
    .from("gym_module_settings")
    .select("gyms:gyms!gym_module_settings_gym_id_fkey(owner_id)")
    .eq("module", module)
    .eq("enabled", false);
  const owners: string[] = [];
  for (const row of (data ?? []) as { gyms: { owner_id: string | null }[] | null }[]) {
    const owner = row.gyms?.[0]?.owner_id;
    if (owner && !owners.includes(owner)) owners.push(owner);
  }
  blockedOwnersCache.set(module, owners);
  return owners;
}