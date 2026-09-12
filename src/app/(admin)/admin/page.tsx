"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Dumbbell,
  GraduationCap,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/market";

interface GlobalStats {
  users_total: number;
  users_alumno: number;
  users_profesor: number;
  users_gym: number;
  gyms_total: number;
  trainers: number;
  students_active: number;
  posts_total: number;
  orders_total: number;
  orders_month: number;
  sales_month: number;
  commission_month: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("admin_global_stats");
      if (data) setStats(data as GlobalStats);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <main className="animate-pulse px-4 pt-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-card" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pt-5 space-y-4">
      <h2 className="text-sm font-semibold text-ink">Resumen global</h2>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Users className="h-3.5 w-3.5 text-neon" /> Usuarios
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{stats?.users_total ?? 0}</p>
          <p className="text-[10px] text-muted">
            {stats?.users_alumno ?? 0} alumnos · {stats?.users_profesor ?? 0} profes · {stats?.users_gym ?? 0} gyms
          </p>
        </div>

        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Dumbbell className="h-3.5 w-3.5 text-ember" /> Gyms
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{stats?.gyms_total ?? 0}</p>
        </div>

        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <GraduationCap className="h-3.5 w-3.5 text-neon" /> Profes
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{stats?.trainers ?? 0}</p>
          <p className="text-[10px] text-muted">{stats?.students_active ?? 0} alumnos activos</p>
        </div>

        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <FileText className="h-3.5 w-3.5 text-green-400" /> Posts
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{stats?.posts_total ?? 0}</p>
        </div>

        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <ShoppingBag className="h-3.5 w-3.5 text-ember" /> Órdenes
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{stats?.orders_total ?? 0}</p>
          <p className="text-[10px] text-muted">{stats?.orders_month ?? 0} este mes</p>
        </div>

        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <TrendingUp className="h-3.5 w-3.5 text-green-400" /> Ventas mes
          </p>
          <p className="mt-1 text-xl font-extrabold text-ink">{formatPrice(stats?.sales_month ?? 0)}</p>
        </div>

        <div className="rounded-2xl border border-neon/30 bg-neon/5 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <DollarSign className="h-3.5 w-3.5 text-neon" /> Comisión mes
          </p>
          <p className="mt-1 text-xl font-extrabold text-neon">{formatPrice(stats?.commission_month ?? 0)}</p>
        </div>
      </div>
    </main>
  );
}
