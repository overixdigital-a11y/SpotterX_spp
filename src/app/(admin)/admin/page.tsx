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
  const [publishRevenue, setPublishRevenue] = useState({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [{ data }, rev] = await Promise.all([
        supabase.rpc("admin_global_stats"),
        supabase.rpc("admin_publish_revenue"),
      ]);
      if (data) setStats(data as GlobalStats);
      if (rev.data) setPublishRevenue(rev.data as { total: number; count: number });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-[#121722]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-[#e4e8ee]">Resumen global</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4 text-[#00e5c7]" />}
          label="Usuarios"
          value={stats?.users_total ?? 0}
          detail={`${stats?.users_alumno ?? 0} alumnos · ${stats?.users_profesor ?? 0} profes · ${stats?.users_gym ?? 0} gyms`}
        />
        <StatCard
          icon={<Dumbbell className="h-4 w-4 text-[#f97316]" />}
          label="Gyms"
          value={stats?.gyms_total ?? 0}
        />
        <StatCard
          icon={<GraduationCap className="h-4 w-4 text-[#00e5c7]" />}
          label="Profes"
          value={stats?.trainers ?? 0}
          detail={`${stats?.students_active ?? 0} alumnos activos`}
        />
        <StatCard
          icon={<FileText className="h-4 w-4 text-[#22c55e]" />}
          label="Posts"
          value={stats?.posts_total ?? 0}
        />
        <StatCard
          icon={<ShoppingBag className="h-4 w-4 text-[#f97316]" />}
          label="Órdenes"
          value={stats?.orders_total ?? 0}
          detail={`${stats?.orders_month ?? 0} este mes`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-[#22c55e]" />}
          label="Ventas mes"
          value={formatPrice(stats?.sales_month ?? 0)}
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-[#00e5c7]" />}
          label="Ingresos publicaciones"
          value={formatPrice(publishRevenue.total)}
          detail={`${publishRevenue.count} publicaciones pagas`}
          accent
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-[#00e5c7]/20 bg-[#00e5c7]/5"
          : "border-[#1e2530] bg-[#121722]"
      }`}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-[#9ca3af]">
        {icon}
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-extrabold ${
          accent ? "text-[#00e5c7]" : "text-[#e4e8ee]"
        }`}
      >
        {value}
      </p>
      {detail && <p className="mt-0.5 text-[11px] text-[#6b7280]">{detail}</p>}
    </div>
  );
}
