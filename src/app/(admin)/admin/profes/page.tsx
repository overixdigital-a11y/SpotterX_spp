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

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, email, avatar_url")
        .in("id", trainerIds);

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
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-[#121722]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#6b7280]">
        {trainers.length} profesor{trainers.length !== 1 ? "es" : ""}
      </p>

      {trainers.length === 0 ? (
        <div className="py-16 text-center">
          <GraduationCap className="mx-auto mb-3 h-8 w-8 text-[#6b7280]" />
          <p className="text-sm text-[#6b7280]">No hay profes registrados</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#1e2530]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#0c1017]">
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">
                  Profesor
                </th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] sm:table-cell">
                  Email
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">
                  Alumnos
                </th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[#1e2530]/50 last:border-0 hover:bg-[#121722]/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00e5c7]/10">
                        <GraduationCap className="h-4 w-4 text-[#00e5c7]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#e4e8ee]">
                          {t.full_name ?? t.username}
                        </p>
                        <p className="text-xs text-[#6b7280]">@{t.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="text-xs text-[#9ca3af]">{t.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#00e5c7]/10 px-2.5 py-1 text-xs font-bold text-[#00e5c7]">
                      <Users className="h-3 w-3" /> {t.student_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
