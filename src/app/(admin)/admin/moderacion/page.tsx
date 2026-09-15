"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Trash2,
  XCircle,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Report {
  id: string;
  reason: string | null;
  status: string;
  created_at: string;
  reporter: { id: string; username: string; full_name: string | null } | null;
  post: { id: string; caption: string | null; media_url: string | null; user_id: string; created_at: string } | null;
}

export default function AdminModeracionPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("admin_list_reports");
      if (data) setReports(data as Report[]);
      setLoading(false);
    };
    load();
  }, []);

  const deletePost = async (report: Report) => {
    if (!report.post) return;
    if (!confirm("¿Eliminar esta publicación?")) return;
    setBusy(report.id);
    const supabase = createClient();
    await supabase.rpc("admin_delete_post", { p_post_id: report.post.id });
    await supabase.rpc("admin_resolve_report", { p_report_id: report.id, p_status: "resolved" });
    setReports((prev) => prev.filter((r) => r.id !== report.id));
    setBusy(null);
  };

  const dismissReport = async (report: Report) => {
    setBusy(report.id);
    const supabase = createClient();
    await supabase.rpc("admin_resolve_report", { p_report_id: report.id, p_status: "dismissed" });
    setReports((prev) => prev.filter((r) => r.id !== report.id));
    setBusy(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-[#121722]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[#e4e8ee]">Reportes pendientes</h3>

      {reports.length === 0 ? (
        <div className="py-16 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[#6b7280]" />
          <p className="text-sm text-[#6b7280]">No hay reportes pendientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-[#9ca3af]">
                    Reportado por{" "}
                    <span className="font-medium text-[#e4e8ee]">
                      @{r.reporter?.username ?? "?"}
                    </span>
                    {" · "}
                    {new Date(r.created_at).toLocaleDateString("es-AR")}
                  </p>
                  {r.reason && (
                    <p className="mt-1 text-xs text-[#e4e8ee]">
                      Motivo: {r.reason}
                    </p>
                  )}
                </div>
              </div>

              {r.post && (
                <div className="mt-2 rounded-md bg-[#0c1017] p-3">
                  <p className="truncate text-xs text-[#e4e8ee]">
                    {r.post.caption ?? "(sin texto)"}
                  </p>
                  {r.post.media_url && (
                    <p className="mt-1 text-[10px] text-[#6b7280]">
                      Tiene multimedia adjunta
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => deletePost(r)}
                  disabled={busy === r.id}
                  className="flex items-center gap-1 rounded-md bg-[#ef4444]/10 px-3 py-1.5 text-[11px] font-medium text-[#ef4444] hover:bg-[#ef4444]/20"
                >
                  {busy === r.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Eliminar post
                </button>
                <button
                  onClick={() => dismissReport(r)}
                  disabled={busy === r.id}
                  className="flex items-center gap-1 rounded-md border border-[#1e2530] px-3 py-1.5 text-[11px] font-medium text-[#9ca3af] hover:border-[#00e5c7]/50"
                >
                  <XCircle className="h-3 w-3" /> Descartar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
