"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BadgeDollarSign, Check, Clock, Loader2, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  STATE_CLASS,
  STATE_LABEL,
  dueLabel,
  formatMoney,
  membershipState,
  type MembershipPayment,
  type TrainerMembership,
} from "@/lib/memberships";

interface Props {
  trainerId: string;
}

export function StudentMembershipCard({ trainerId }: Props) {
  const [membership, setMembership] = useState<TrainerMembership | null>(null);
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        if (alive) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("trainer_memberships")
        .select("*")
        .eq("trainer_id", trainerId)
        .eq("student_id", uid)
        .maybeSingle();
      const row = (data as TrainerMembership | null) ?? null;
      if (row) {
        const { data: pays } = await supabase
          .from("trainer_membership_payments")
          .select("*")
          .eq("membership_id", row.id)
          .order("paid_at", { ascending: false })
          .limit(3);
        if (alive) setPayments((pays as MembershipPayment[]) ?? []);
      }
      if (alive) {
        setMembership(row);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [trainerId]);

  if (loading) {
    return (
      <div className="mt-3 flex justify-center rounded-xl border border-edge bg-card py-6">
        <Loader2 className="h-5 w-5 animate-spin text-neon" />
      </div>
    );
  }

  if (!membership) return null;

  const state = membershipState(membership);
  const last = payments[0];

  return (
    <div className="mt-3 rounded-xl border border-edge bg-card p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ember/15">
          <BadgeDollarSign className="h-4 w-4 text-ember" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{membership.plan_name}</p>
          <p className="truncate text-[11px] text-muted">
            {formatMoney(membership.price)} · {dueLabel(membership.expires_on)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATE_CLASS[state]}`}
        >
          {STATE_LABEL[state]}
        </span>
      </div>

      {(state === "vencido" || state === "pendiente") && (
        <p className="mt-2.5 flex items-start gap-2 rounded-lg border border-ember/40 bg-ember/10 px-3 py-2.5 text-[11px] text-ink">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember" />
          <span>
            Tu cuota esta al dia con tu profe? Hable con el para regularizar el
            pago: el se encarga de marcarlo y extender el vencimiento.
          </span>
        </p>
      )}

      {state === "por_vencer" && (
        <p className="mt-2.5 flex items-start gap-2 rounded-lg border border-edge bg-elevated/40 px-3 py-2.5 text-[11px] text-muted">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Recorda renovar antes del {membership.expires_on ? new Date(`${membership.expires_on}T00:00:00`).toLocaleDateString("es-AR") : ""}.
          </span>
        </p>
      )}

      {last ? (
        <p className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
          <Receipt className="h-3.5 w-3.5 shrink-0 text-neon" />
          Ultimo pago {formatMoney(last.amount)} ·{" "}
          {new Date(last.paid_at).toLocaleDateString("es-AR")}
        </p>
      ) : (
        <p className="mt-2.5 flex items-center gap-2 text-[11px] text-muted">
          <Check className="h-3.5 w-3.5 shrink-0 text-neon" />
          Todavia no hay pagos registrados.
        </p>
      )}
    </div>
  );
}
