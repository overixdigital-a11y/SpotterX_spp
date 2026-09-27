"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeDollarSign,
  Check,
  Clock,
  History,
  Loader2,
  Pencil,
  Receipt,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BottomSheet } from "@/components/core/BottomSheet";
import { useToast } from "@/components/core/ToastProvider";
import { todayLocal } from "@/lib/format";
import {
  DURATIONS,
  STATE_CLASS,
  STATE_LABEL,
  addMonths,
  daysUntil,
  dueLabel,
  formatMoney,
  formatShort,
  membershipState,
  type MembershipPayment,
  type MembershipState,
  type TrainerMembership,
} from "@/lib/memberships";

interface Props {
  trainerId: string;
  studentId: string;
  studentName: string;
}

export function MembershipCard({ trainerId, studentId, studentName }: Props) {
  const toast = useToast();
  const [membership, setMembership] = useState<TrainerMembership | null>(null);
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    plan_name: "Mensualidad",
    price: "",
    duration_months: "1",
    paid: "pagado",
    notes: "",
  });
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("trainer_memberships")
      .select("*")
      .eq("trainer_id", trainerId)
      .eq("student_id", studentId)
      .maybeSingle();
    const row = (data as TrainerMembership | null) ?? null;
    setMembership(row);

    if (row) {
      const { data: pays } = await supabase
        .from("trainer_membership_payments")
        .select("*")
        .eq("membership_id", row.id)
        .order("paid_at", { ascending: false })
        .limit(30);
      setPayments((pays as MembershipPayment[]) ?? []);
    } else {
      setPayments([]);
    }
    setLoading(false);
  }, [trainerId, studentId]);

  useEffect(() => {
    let active = true;
    (async () => {
      await load();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const openForm = () => {
    setForm({
      plan_name: membership?.plan_name || "Mensualidad",
      price: membership?.price != null ? String(membership.price) : "",
      duration_months: String(membership?.duration_months ?? 1),
      paid: membership?.pay_status === "pendiente" ? "pendiente" : "pagado",
      notes: membership?.notes || "",
    });
    setFormOpen(true);
  };

  const save = async () => {
    const name = form.plan_name.trim() || "Mensualidad";
    const price = form.price.trim() === "" ? null : Number(form.price);
    if (price !== null && (Number.isNaN(price) || price < 0)) {
      toast("El precio no es valido", "error");
      return;
    }
    const months = Number(form.duration_months) || 1;
    const today = todayLocal();
    const paid = form.paid === "pagado";
    const wasPaid =
      membership?.pay_status === "pagado" || membership?.pay_status === "promo";
    const current = membership?.expires_on ?? null;
    // Editar el precio de una cuota ya pagada NO corre meses: el vencimiento solo
    // se recalcula al crear o al pasar de pendiente a pagado.
    let expires: string;
    if (!paid) {
      expires = today;
    } else if (!membership) {
      expires = addMonths(today, months);
    } else if (wasPaid) {
      expires = current ?? addMonths(today, months);
    } else {
      expires = addMonths(current && current > today ? current : today, months);
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("trainer_memberships").upsert(
        {
          trainer_id: trainerId,
          student_id: studentId,
          plan_name: name,
          price,
          duration_months: months,
          starts_on: membership?.starts_on || today,
          expires_on: expires,
          pay_status: paid ? "pagado" : "pendiente",
          status: "activa",
          notes: form.notes.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "trainer_id,student_id" }
      );
      if (error) throw new Error(error.message);
      setFormOpen(false);
      await load();
      toast(paid ? "Membresia guardada" : "Membresia guardada, pendiente de pago", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(
        msg.includes("trainer_memberships") || msg.includes("does not exist")
          ? "Falta correr la migracion 00044 para usar las cuotas"
          : `No se pudo guardar: ${msg}`,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async () => {
    if (!membership) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const amount = payAmount.trim() === "" ? null : Number(payAmount);
      const { error } = await supabase.rpc("trainer_mark_membership_paid", {
        p_membership_id: membership.id,
        p_amount: amount,
        p_note: payNote.trim() || null,
      });
      if (error) throw new Error(error.message);
      setPayOpen(false);
      setPayAmount("");
      setPayNote("");
      await load();
      toast("Pago registrado", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(
        msg.includes("trainer_mark_membership_paid")
          ? "Falta correr la migracion 00044 para marcar pagos"
          : `No se pudo registrar: ${msg}`,
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!membership) return;
    const next = membership.status === "activa" ? "inactiva" : "activa";
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("trainer_memberships")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", membership.id);
      if (error) throw new Error(error.message);
      await load();
      toast(next === "activa" ? "Cuota reactivada" : "Cuota pausada", "success");
    } catch (e) {
      toast(`No se pudo cambiar: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-edge bg-card px-3 py-3 text-xs text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando membresia...
      </div>
    );
  }

  const state: MembershipState = membershipState(membership);

  if (!membership) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-edge bg-card p-3">
        <div className="flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4 text-ember" />
          <p className="text-sm font-semibold text-ink">Membresia mensual</p>
        </div>
        <p className="mt-1 text-xs text-muted">
          {studentName} todavia no tiene una membresia con vos.
        </p>
        <button
          onClick={openForm}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-ember/40 bg-ember/10 py-2.5 text-sm font-semibold text-ember"
        >
          <BadgeDollarSign className="h-4 w-4" /> Crear membresia
        </button>
        <FormSheet
          open={formOpen}
          onClose={() => setFormOpen(false)}
          form={form}
          setForm={setForm}
          saving={saving}
          onSave={save}
          isEdit={false}
        />
      </div>
    );
  }

  const days = membership.expires_on ? daysUntil(membership.expires_on) : null;

  return (
    <div className="mt-3 rounded-xl border border-edge bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4 text-ember" />
          <p className="text-sm font-bold text-ink">{membership.plan_name}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
            STATE_CLASS[state]
          }`}
        >
          {STATE_LABEL[state]}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="text-sm font-bold text-ink">
          {formatMoney(membership.price)}
          <span className="font-normal text-muted">
            {membership.duration_months > 1
              ? ` / ${membership.duration_months} meses`
              : " / mes"}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {dueLabel(membership.expires_on)}
          {days !== null && days >= 0 && days <= 3 && ` (${days}d)`}
        </span>
        {membership.pay_status === "pendiente" && (
          <span className="rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[10px] font-semibold text-ember">
            ultimo pago pendiente
          </span>
        )}
      </div>

      {membership.notes && (
        <p className="mt-2 text-xs text-muted">{membership.notes}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setPayAmount(membership.price != null ? String(membership.price) : "");
            setPayNote("");
            setPayOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-neon px-3 py-2 text-xs font-semibold text-bg shadow-neon"
        >
          <Check className="h-3.5 w-3.5" /> Marcar pago
        </button>
        <button
          onClick={openForm}
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-semibold text-ink"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button
          onClick={() => setHistOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-semibold text-ink"
        >
          <History className="h-3.5 w-3.5" /> Historial
          {payments.length > 0 && (
            <span className="text-muted">({payments.length})</span>
          )}
        </button>
        <button
          onClick={toggleStatus}
          disabled={busy}
          className="ml-auto rounded-lg px-2 py-2 text-[11px] font-medium text-muted hover:text-ink disabled:opacity-60"
        >
          {membership.status === "activa" ? "Pausar cuota" : "Reanudar"}
        </button>
      </div>

      <FormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        form={form}
        setForm={setForm}
        saving={saving}
        onSave={save}
        isEdit
      />

      <BottomSheet open={payOpen} onClose={() => setPayOpen(false)} title="Registrar pago">
        <p className="text-xs text-muted">
          Se extiende el vencimiento {membership.duration_months}{" "}
          {membership.duration_months === 1 ? "mes" : "meses"} y queda en el
          historial. {studentName} recibe el aviso.
        </p>
        <div className="mt-4 space-y-3">
          <input
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            inputMode="numeric"
            placeholder={`Monto (${formatMoney(membership.price)})`}
            className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
          <input
            value={payNote}
            onChange={(e) => setPayNote(e.target.value)}
            placeholder="Nota (opcional)"
            className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
        </div>
        <button
          onClick={markPaid}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-3 text-sm font-semibold text-bg shadow-neon disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Confirmar pago
        </button>
      </BottomSheet>

      <BottomSheet
        open={histOpen}
        onClose={() => setHistOpen(false)}
        title="Historial de pagos"
      >
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Todavia no hay pagos registrados.
          </p>
        ) : (
          <div>
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 border-b border-edge py-2.5"
              >
                <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {formatMoney(p.amount)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {new Date(p.paid_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  {p.period_to && (
                    <p className="text-[11px] text-muted">
                      Cubre hasta el {formatShort(p.period_to)}
                    </p>
                  )}
                  {p.note && <p className="mt-0.5 text-xs text-muted">{p.note}</p>}
                </div>
              </div>
            ))}
            <p className="mt-3 text-[11px] text-muted">
              <Wallet className="mr-1 inline h-3 w-3" />
              Cobro manual: la plata se mueve fuera de la app.
            </p>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

interface FormSheetProps {
  open: boolean;
  onClose: () => void;
  form: {
    plan_name: string;
    price: string;
    duration_months: string;
    paid: string;
    notes: string;
  };
  setForm: (f: {
    plan_name: string;
    price: string;
    duration_months: string;
    paid: string;
    notes: string;
  }) => void;
  saving: boolean;
  onSave: () => void;
  isEdit: boolean;
}

function FormSheet({
  open,
  onClose,
  form,
  setForm,
  saving,
  onSave,
  isEdit,
}: FormSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar membresia" : "Crear membresia"}
    >
      <div className="space-y-3">
        <input
          value={form.plan_name}
          onChange={(e) => setForm({ ...form, plan_name: e.target.value })}
          placeholder="Nombre (ej: Mensualidad)"
          className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            inputMode="numeric"
            placeholder="Precio"
            className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none"
          />
          <select
            value={form.duration_months}
            onChange={(e) => setForm({ ...form, duration_months: e.target.value })}
            className="rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink focus:border-ember focus:outline-none"
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} {d === 1 ? "mes" : "meses"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {isEdit ? "Pago" : "Primer pago"}
          </p>
          <div className="flex gap-2">
            {[
              ["pagado", "Ya pago"],
              ["pendiente", "Pendiente"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setForm({ ...form, paid: value })}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  form.paid === value
                    ? "border-neon bg-neon/15 text-neon"
                    : "border-edge text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Guardar con &quot;Ya pago&quot; da de alta el periodo; con &quot;Pendiente&quot;
            el alumno figura debiendo desde hoy.
          </p>
        </div>
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notas (opcional)"
          className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none"
        />
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-ember py-3 text-sm font-semibold text-bg disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear membresia"}
      </button>
    </BottomSheet>
  );
}
