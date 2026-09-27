"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeDollarSign, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  formatMoney,
  membershipState,
  type TrainerMembership,
} from "@/lib/memberships";

interface Summary {
  own: number;
  alDia: number;
  porVencer: number;
  vencido: number;
  pendiente: number;
  sinMembresia: number;
  porCobrar: number;
}

export function MembershipSummary() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: links } = await supabase
        .from("trainer_students")
        .select("student_id")
        .eq("active", true)
        .eq("source", "propio");
      const ids = ((links ?? []) as { student_id: string }[]).map(
        (l) => l.student_id
      );
      if (ids.length === 0) {
        if (alive) {
          setData({
            own: 0,
            alDia: 0,
            porVencer: 0,
            vencido: 0,
            pendiente: 0,
            sinMembresia: 0,
            porCobrar: 0,
          });
        }
        return;
      }

      const { data: rows } = await supabase
        .from("trainer_memberships")
        .select("*")
        .in("student_id", ids);

      const memberships = (rows as TrainerMembership[]) ?? [];
      const summary: Summary = {
        own: ids.length,
        alDia: 0,
        porVencer: 0,
        vencido: 0,
        pendiente: 0,
        sinMembresia: Math.max(0, ids.length - memberships.length),
        porCobrar: 0,
      };
      for (const m of memberships) {
        const state = membershipState(m);
        if (state === "inactiva") continue;
        if (state === "al_dia") summary.alDia++;
        else if (state === "por_vencer") summary.porVencer++;
        else if (state === "vencido") summary.vencido++;
        if (state === "vencido" || m.pay_status === "pendiente") {
          summary.pendiente++;
          summary.porCobrar += m.price ?? 0;
        }
      }
      if (alive) setData(summary);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null;

  return (
    <Link
      href="/entrenamiento/cuotas"
      className="mt-4 flex items-center gap-3 rounded-xl border border-edge bg-card px-3.5 py-3 transition hover:border-neon/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ember/15">
        <BadgeDollarSign className="h-4 w-4 text-ember" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Cuotas de tus alumnos</p>
        <p className="truncate text-[11px] text-muted">
          {data.own === 0
            ? "Todavia no tenes alumnos propios"
            : `${formatMoney(data.porCobrar)} por cobrar · ${data.vencido} vencidas · ${data.pendiente} pendientes · ${data.alDia} al dia`}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}
