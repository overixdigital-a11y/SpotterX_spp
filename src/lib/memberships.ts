import { todayLocal } from "@/lib/format";

export interface TrainerMembership {
  id: string;
  trainer_id: string;
  student_id: string;
  plan_name: string;
  price: number | null;
  duration_months: number;
  starts_on: string;
  expires_on: string | null;
  pay_status: "pagado" | "pendiente" | "promo";
  status: "activa" | "inactiva";
  notes: string | null;
}

export interface MembershipPayment {
  id: string;
  membership_id: string;
  amount: number | null;
  method: string;
  period_from: string | null;
  period_to: string | null;
  note: string | null;
  paid_at: string;
}

export type MembershipState =
  | "al_dia"
  | "por_vencer"
  | "vencido"
  | "pendiente"
  | "inactiva";

export const DURATIONS = [1, 2, 3, 6] as const;

export function addMonths(dateStr: string, months: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function membershipState(
  m: Pick<TrainerMembership, "expires_on" | "pay_status" | "status"> | null | undefined,
  today = todayLocal()
): MembershipState {
  if (!m) return "pendiente";
  if (m.status === "inactiva") return "inactiva";
  if (!m.expires_on) return m.pay_status === "pagado" ? "al_dia" : "pendiente";
  const left = daysUntil(m.expires_on, today);
  if (left < 0) return "vencido";
  if (left <= 3) return "por_vencer";
  return "al_dia";
}

export function daysUntil(dateStr: string, today = todayLocal()) {
  const a = new Date(`${today}T00:00:00`).getTime();
  const b = new Date(`${dateStr}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export const STATE_LABEL: Record<MembershipState, string> = {
  al_dia: "Al dia",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  pendiente: "Sin pagar",
  inactiva: "Pausada",
};

export const STATE_CLASS: Record<MembershipState, string> = {
  al_dia: "border-neon/40 bg-neon/10 text-neon",
  por_vencer: "border-ember/40 bg-ember/10 text-ember",
  vencido: "border-ember bg-ember/20 text-ember",
  pendiente: "border-edge bg-elevated text-muted",
  inactiva: "border-edge bg-elevated text-muted",
};

export function formatMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `$${n.toLocaleString("es-AR")}`;
}

export function dueLabel(expires_on: string | null | undefined, today = todayLocal()) {
  if (!expires_on) return "sin vencimiento";
  const d = daysUntil(expires_on, today);
  if (d < 0) return `vencio el ${formatShort(expires_on)}`;
  if (d === 0) return "vence hoy";
  if (d === 1) return "vence manana";
  return `vence el ${formatShort(expires_on)}`;
}

export function formatShort(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
