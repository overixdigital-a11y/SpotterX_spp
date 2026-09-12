"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface TrainerRow {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  student_count: number;
}

export default function AdminProfesPage() {
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      // Get authorized trainers from gym_staff
      const { data: staff } = await supabase
        .from("gym_staff")
        .select("user_id")
        .eq("role", "profesor_invitado")
        .eq("authorized", true);

      if (!staff || staff.length === 0) {
        setLoading(false);
        return;
      }

      const trainerIds = [...new Set(staff.map((s) => s.user_id))];

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, email, avatar_url")
        .in("id", trainerIds);

      // Get student counts
      const { data: students } = await supabase
        .from("trainer_students")
        .select("trainer_id")
        .eq("active", true)
        .in("trainer_id", trainerIds);

      const countMap = new Map<string, number>();
      students?.forEach((s) => {
        countMap.set(s.trainer_id, (countMap.get(s.trainer_id) ?? 0) + 1);
      });

      if (profiles) {
        setTrainers(
          profiles.map((p) => ({
            ...p,
            student_count: countMap.get(p.id) ?? 0,
          }))
        );
      }
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
      <p className="text-xs text-muted">{trainers.length} profesor{trainers.length !== 1 ? "es" : ""}</p>

      {trainers.length === 0 ? (
        <div className="py-12 text-center">
          <GraduationCap className="mx-auto mb-3 h-8 w-8 text-muted" />
          <p className="text-sm text-muted">No hay profes registrados</p>
        </div>
      ) : (
        trainers.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-edge bg-card p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon/15">
              <GraduationCap className="h-5 w-5 text-neon" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{t.full_name ?? t.username}</p>
              <p className="text-xs text-muted">@{t.username}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-neon/15 px-2.5 py-1 text-xs font-bold text-neon">
              <Users className="h-3 w-3" /> {t.student_count}
            </span>
          </div>
        ))
      )}
    </main>
  );
}
