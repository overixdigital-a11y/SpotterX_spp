"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Users, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface GymRow {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  owner_id: string;
  created_at: string;
  member_count?: number;
}

export default function AdminGymsPage() {
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("gyms")
        .select("id, name, city, address, owner_id, created_at")
        .order("created_at", { ascending: false });
      if (!data) { setLoading(false); return; }

      // Get member counts
      const gymIds = data.map((g) => g.id);
      const { data: memberships } = await supabase
        .from("gym_memberships")
        .select("gym_id")
        .eq("status", "activa")
        .in("gym_id", gymIds);

      const countMap = new Map<string, number>();
      memberships?.forEach((m) => {
        countMap.set(m.gym_id, (countMap.get(m.gym_id) ?? 0) + 1);
      });

      setGyms(
        data.map((g) => ({ ...g, member_count: countMap.get(g.id) ?? 0 }))
      );
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <main className="animate-pulse px-4 pt-5 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-card" />
        ))}
      </main>
    );
  }

  return (
    <main className="px-4 pt-5 space-y-3">
      <p className="text-xs text-muted">{gyms.length} gimnasio{gyms.length !== 1 ? "s" : ""}</p>

      {gyms.length === 0 ? (
        <div className="py-12 text-center">
          <Dumbbell className="mx-auto mb-3 h-8 w-8 text-muted" />
          <p className="text-sm text-muted">No hay gyms registrados</p>
        </div>
      ) : (
        gyms.map((g) => (
          <div key={g.id} className="flex items-center gap-3 rounded-xl border border-edge bg-card p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember/15">
              <Dumbbell className="h-5 w-5 text-ember" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{g.name}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted">
                {g.city && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" /> {g.city}
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Users className="h-3 w-3" /> {g.member_count} miembros
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </main>
  );
}
