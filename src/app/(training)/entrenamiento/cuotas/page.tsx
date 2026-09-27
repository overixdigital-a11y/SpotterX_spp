"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  BadgeDollarSign,
  Check,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Receipt,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useModuleGuard } from "@/lib/gym-modules";
import { BottomSheet } from "@/components/core/BottomSheet";
import { useToast } from "@/components/core/ToastProvider";
import { AccountingSummary } from "@/components/accounting/AccountingSummary";
import { todayLocal } from "@/lib/format";
import {
  currentMonth,
  fillSeries,
  monthStart,
  normalizeAccounting,
  paymentsCsv,
  shiftMonth,
  type AccountingData,
} from "@/lib/accounting";
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

// recharts pesa (~100 KB): lazy (patron Lote 32).
const MonthIncomeChart = dynamic(
  () => import("@/components/accounting/MonthIncomeChart").then((m) => m.MonthIncomeChart),
  { ssr: false }
);

interface Row {
  student: { id: string; username: string; full_name: string | null };
  membership: TrainerMembership | null;
  state: MembershipState;
}

type Filter = "todos" | "al_dia" | "por_vencer" | "vencido" | "sin_membresia";
type Tab = "resumen" | "alumnos";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "al_dia", label: "Al dia" },
  { key: "por_vencer", label: "Por vencer" },
  { key: "vencido", label: "Vencidos" },
  { key: "sin_membresia", label: "Sin membresia" },
];

export default function CuotasPage() {
  const { userId } = useAuthState();
  const { busy } = useModuleGuard("entrenamiento");
  const toast = useToast();

  const [rows, setRows] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Record<string, MembershipPayment[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("todos");
  const [tab, setTab] = useState<Tab>("resumen");
  const [month, setMonth] = useState<string>(() => currentMonth());
  const [acc, setAcc] = useState<AccountingData | null>(null);
  const [accNames, setAccNames] = useState<Map<string, string>>(new Map());
  const [accMissing, setAccMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formFor, setFormFor] = useState<Row | null>(null);
  const [payFor, setPayFor] = useState<Row | null>(null);
  const [histFor, setHistFor] = useState<Row | null>(null);
  const [form, setForm] = useState({
    plan_name: "Mensualidad",
    price: "",
    duration_months: "1",
    paid: "pagado",
    notes: "",
  });
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data: links } = await supabase
      .from("trainer_students")
      .select("student_id, source")
      .eq("trainer_id", userId)
      .eq("active", true)
      .eq("source", "propio");

    const ids = ((links ?? []) as { student_id: string }[]).map((l) => l.student_id);
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const [{ data: profiles }, { data: memberships }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", ids),
      supabase.from("trainer_memberships").select("*").eq("trainer_id", userId),
    ]);

    const byProfile = new Map(
      ((profiles ?? []) as { id: string; username: string; full_name: string | null }[]).map(
        (p) => [p.id, p]
      )
    );
    const byStudent = new Map(
      ((memberships ?? []) as TrainerMembership[]).map((m) => [m.student_id, m])
    );

    setRows(
      ids.map((id) => {
        const membership = byStudent.get(id) ?? null;
        return {
          student: byProfile.get(id) ?? {
            id,
            username: "alumno",
            full_name: null,
          },
          membership,
          state: membershipState(membership),
        };
      })
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (!alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  // Contabilidad del profe: la RPC calcula todo en el servidor (mismo shape que
  // la del gym) y las consultas separadas resuelven los nombres para el CSV.
  const loadAccounting = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("trainer_accounting_summary", {
      p_month: month,
    });
    if (error) {
      // Mismo criterio que en /gimnasio/contabilidad: SOLO "no existe la funcion"
      // es la 00046 faltante. Cualquier otro error se muestra crudo.
      const missingRpc =
        error.message.includes("Could not find the function") ||
        (error.message.includes("does not exist") && error.message.includes("schema cache"));
      if (missingRpc) {
        setAccMissing(true);
      } else {
        toast(`No se pudo cargar el resumen: ${error.message}`, "error");
      }
      setAcc(null);
      return;
    }
    setAccMissing(false);
    const next = normalizeAccounting(data);
    setAcc(next);

    const ids = [...new Set(next.detalle.map((p) => p.socio))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", ids);
      setAccNames(new Map((profs ?? []).map((p) => [p.id, p.full_name || p.username || "Alumno"])));
    } else {
      setAccNames(new Map());
    }
  }, [userId, month, toast]);

  // Patron anti-lint del repo: setState nunca sincrono en el cuerpo del efecto.
  useEffect(() => {
    let alive = true;
    (async () => {
      await loadAccounting();
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, [loadAccounting]);

  const loadPayments = useCallback(async (membershipId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("trainer_membership_payments")
      .select("*")
      .eq("membership_id", membershipId)
      .order("paid_at", { ascending: false })
      .limit(50);
    const list = (data as MembershipPayment[]) ?? [];
    setPayments((prev) => ({ ...prev, [membershipId]: list }));
    return list;
  }, []);

  const kpis = useMemo(() => {
    let porCobrar = 0;
    let alDia = 0;
    let porVencer = 0;
    let vencidos = 0;
    let sinMembresia = 0;
    for (const r of rows) {
      if (!r.membership) {
        sinMembresia++;
        continue;
      }
      if (r.state === "inactiva") continue;
      const price = r.membership.price ?? 0;
      if (r.state === "vencido") {
        vencidos++;
        porCobrar += price;
      } else if (r.state === "por_vencer") {
        porVencer++;
      } else if (r.state === "al_dia") {
        alDia++;
      }
    }
    const pendientes = rows.filter(
      (r) =>
        r.membership &&
        r.state !== "inactiva" &&
        r.membership.pay_status === "pendiente"
    );
    for (const r of pendientes) porCobrar += r.membership?.price ?? 0;
    return { porCobrar, alDia, porVencer, vencidos, sinMembresia };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "todos") return rows;
    if (filter === "sin_membresia") return rows.filter((r) => !r.membership);
    return rows.filter((r) => r.membership && r.state === filter);
  }, [rows, filter]);

  const openForm = (r: Row) => {
    setForm({
      plan_name: r.membership?.plan_name || "Mensualidad",
      price: r.membership?.price != null ? String(r.membership.price) : "",
      duration_months: String(r.membership?.duration_months ?? 1),
      paid: r.membership?.pay_status === "pendiente" ? "pendiente" : "pagado",
      notes: r.membership?.notes || "",
    });
    setFormFor(r);
  };

  const save = async () => {
    if (!formFor || !userId) return;
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
      formFor.membership?.pay_status === "pagado" ||
      formFor.membership?.pay_status === "promo";
    const current = formFor.membership?.expires_on ?? null;
    // Editar el precio de una cuota ya pagada NO corre meses.
    let expires: string;
    if (!paid) {
      expires = today;
    } else if (!formFor.membership) {
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
          trainer_id: userId,
          student_id: formFor.student.id,
          plan_name: name,
          price,
          duration_months: months,
          starts_on: formFor.membership?.starts_on || today,
          expires_on: expires,
          pay_status: paid ? "pagado" : "pendiente",
          status: "activa",
          notes: form.notes.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "trainer_id,student_id" }
      );
      if (error) throw new Error(error.message);
      setFormFor(null);
      await load();
      toast(paid ? "Membresia guardada" : "Membresia guardada, pendiente de pago", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(
        msg.includes("does not exist") || msg.includes("trainer_memberships")
          ? "Falta correr la migracion 00044 para usar las cuotas"
          : `No se pudo guardar: ${msg}`,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async () => {
    if (!payFor?.membership) return;
    const m = payFor.membership;
    setBusyId(m.id);
    try {
      const supabase = createClient();
      const amount = payAmount.trim() === "" ? null : Number(payAmount);
      const { error } = await supabase.rpc("trainer_mark_membership_paid", {
        p_membership_id: m.id,
        p_amount: amount,
        p_note: payNote.trim() || null,
      });
      if (error) throw new Error(error.message);
      setPayFor(null);
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
      setBusyId(null);
    }
  };

  const exportCsv = () => {
    const lines = [
      "alumno;usuario;membresia;precio;estado;vence;dias",
      ...filtered.map((r) => {
        const m = r.membership;
        return [
          r.student.full_name || r.student.username,
          `@${r.student.username}`,
          m?.plan_name || "sin membresia",
          m?.price ?? "",
          m ? STATE_LABEL[r.state] : "Sin membresia",
          m?.expires_on || "",
          m?.expires_on ? daysUntil(m.expires_on) : "",
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(";");
      }),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuotas-${todayLocal()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV exportado", "success");
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-ember" />
      </main>
    );
  }

  if (busy) {
    return (
      <main className="flex justify-center pt-20">
        <Loader2 className="h-6 w-6 animate-spin text-ember" />
      </main>
    );
  }

  const nameOf = (r: Row) => r.student.full_name || r.student.username;

  return (
    <main className="mx-auto max-w-xl px-4 pt-5 md:max-w-2xl lg:max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink">Cuotas</h1>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-full border border-edge px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-neon/40 hover:text-neon"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Membresias de tus alumnos propios. El cobro es manual: registras el pago
        y el vencimiento se extiende solo.
      </p>

      {/* Pestañas: el resumen contable vive aca, la gestion por alumno queda
          igual que estaba (Lote 38) para no romper nada de lo ya usado. */}
      <div className="mt-4 flex gap-1 rounded-xl border border-edge bg-card p-1">
        {(
          [
            { key: "resumen", label: "Resumen" },
            { key: "alumnos", label: "Alumnos" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              tab === t.key ? "bg-ember text-bg" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumen" && (
        <div className="mt-4">
          {accMissing ? (
            <p className="rounded-xl border border-ember/30 bg-ember/5 p-4 text-center text-xs text-muted">
              Falta correr la migracion <span className="font-semibold text-ember">00046</span> para
              ver el resumen. La gestion de alumnos ya funciona igual.
            </p>
          ) : !acc ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-ember" />
            </div>
          ) : (
            <AccountingSummary
              data={acc}
              month={month}
              isCurrentMonth={month >= currentMonth()}
              canGoNext={month < monthStart(shiftMonth(currentMonth(), 1))}
              onPrev={() => setMonth((m) => monthStart(shiftMonth(m, -1)))}
              onNext={() => setMonth((m) => monthStart(shiftMonth(m, 1)))}
              onExport={() => {
                if (acc.detalle.length === 0) {
                  toast("No hay cobros en este mes para exportar", "info");
                  return;
                }
                const csv = paymentsCsv(acc.detalle, (id) => accNames.get(id) ?? "Alumno");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `cuotas-profesor-${month}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast("Movimiento exportado", "success");
              }}
              chart={<MonthIncomeChart data={fillSeries(acc.serie, month)} />}
            />
          )}
        </div>
      )}

      {tab === "alumnos" && (
      <>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-ember/40 bg-ember/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ember">
            Por cobrar
          </p>
          <p className="mt-1 text-2xl font-black text-ink">{formatMoney(kpis.porCobrar)}</p>
          <p className="text-[11px] text-muted">{kpis.vencidos} vencidos</p>
        </div>
        <div className="rounded-xl border border-edge bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Al dia
          </p>
          <p className="mt-1 text-2xl font-black text-neon">{kpis.alDia}</p>
          <p className="text-[11px] text-muted">
            {kpis.porVencer} por vencer · {kpis.sinMembresia} sin membresia
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.key
                ? "border-ember bg-ember text-bg"
                : "border-edge bg-card text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          Todavia no tenes alumnos propios.{" "}
          <Link href="/entrenamiento" className="text-neon">
            Ir a Mis alumnos
          </Link>
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          Ningun alumno en este filtro.
        </p>
      ) : (
        <div className="mt-3">
          {filtered.map((r) => (
            <div key={r.student.id} className="border-b border-edge py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember/20 text-sm font-bold text-ember">
                  {nameOf(r).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {nameOf(r)}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {r.membership ? (
                      <>
                        {r.membership.plan_name} · {formatMoney(r.membership.price)} ·{" "}
                        {dueLabel(r.membership.expires_on)}
                      </>
                    ) : (
                      "sin membresia"
                    )}
                  </p>
                </div>
                {r.membership ? (
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                      STATE_CLASS[r.state]
                    }`}
                  >
                    {STATE_LABEL[r.state]}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 pl-[52px]">
                {r.membership ? (
                  <>
                    <button
                      onClick={() => {
                        setPayAmount(
                          r.membership?.price != null ? String(r.membership.price) : ""
                        );
                        setPayNote("");
                        setPayFor(r);
                      }}
                      disabled={busyId === r.membership.id}
                      className="flex items-center gap-1.5 rounded-lg bg-neon px-3 py-1.5 text-xs font-semibold text-bg shadow-neon disabled:opacity-60"
                    >
                      {busyId === r.membership.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Marcar pago
                    </button>
                    <button
                      onClick={() => openForm(r)}
                      className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-semibold text-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => {
                        setHistFor(r);
                        void loadPayments(r.membership!.id);
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-semibold text-ink"
                    >
                      <Receipt className="h-3.5 w-3.5" /> Historial
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openForm(r)}
                    className="flex items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/10 px-3 py-1.5 text-xs font-semibold text-ember"
                  >
                    <BadgeDollarSign className="h-3.5 w-3.5" /> Crear membresia
                  </button>
                )}
                <Link
                  href={`/entrenamiento/alumno/${r.student.id}`}
                  className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-neon"
                >
                  Ficha <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-[11px] text-muted">
        <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        SpotterX no cobra comision de las cuotas: la plata se mueve fuera de la
        app y queda registrada en el historial.
      </p>
      </>
      )}

      {/* Crear / editar */}
      <BottomSheet
        open={formFor !== null}
        onClose={() => setFormFor(null)}
        title={
          formFor?.membership ? "Editar membresia" : "Crear membresia"
        }
      >
        {formFor && (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Membresia de <span className="font-semibold text-ember">{nameOf(formFor)}</span>
            </p>
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
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notas (opcional)"
              className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none"
            />
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setFormFor(null)}
            className="flex-1 rounded-lg border border-edge py-3 text-sm font-semibold text-muted"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-ember py-3 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </BottomSheet>

      {/* Marcar pago */}
      <BottomSheet
        open={payFor !== null}
        onClose={() => setPayFor(null)}
        title="Registrar pago"
      >
        {payFor?.membership && (
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Membresia de{" "}
              <span className="font-semibold text-neon">{nameOf(payFor)}</span>. Se
              extiende el vencimiento {payFor.membership.duration_months}{" "}
              {payFor.membership.duration_months === 1 ? "mes" : "meses"} y queda en
              el historial; {nameOf(payFor)} recibe el aviso.
            </p>
            <input
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              inputMode="numeric"
              placeholder={`Monto (${formatMoney(payFor.membership.price)})`}
              className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <input
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="Nota (opcional)"
              className="w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setPayFor(null)}
            className="flex-1 rounded-lg border border-edge py-3 text-sm font-semibold text-muted"
          >
            Cancelar
          </button>
          <button
            onClick={markPaid}
            disabled={busyId === payFor?.membership?.id}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neon py-3 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {busyId === payFor?.membership?.id && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Confirmar
          </button>
        </div>
      </BottomSheet>

      {/* Historial */}
      <BottomSheet
        open={histFor !== null}
        onClose={() => setHistFor(null)}
        title="Historial de pagos"
      >
        {histFor?.membership && (
          <p className="text-xs text-muted">
            {nameOf(histFor)} · {histFor.membership.plan_name}
          </p>
        )}
        {(histFor?.membership && (payments[histFor.membership.id] ?? []).length) ===
        0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Todavia no hay pagos registrados.
          </p>
        ) : (
          <div className="mt-2">
            {(histFor?.membership ? payments[histFor.membership.id] ?? [] : []).map(
              (p) => (
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
              )
            )}
          </div>
        )}
        <button
          onClick={() => setHistFor(null)}
          className="mt-5 w-full rounded-lg border border-edge py-3 text-sm font-semibold text-muted"
        >
          Cerrar
        </button>
      </BottomSheet>
    </main>
  );
}
