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
      <main className="animate-pulse px-4 pt-5 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-card" />
        ))}
      </main>
    );
  }

  return (
    <main className="px-4 pt-5 space-y-3">
      <h3 className="text-sm font-semibold text-ink">Reportes pendientes</h3>

      {reports.length === 0 ? (
        <div className="py-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted" />
          <p className="text-sm text-muted">No hay reportes pendientes</p>
        </div>
      ) : (
        reports.map((r) => (
          <div key={r.id} className="rounded-xl border border-edge bg-card p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted">
                  Reportado por <span className="font-semibold text-ink">@{r.reporter?.username ?? "?"}</span>
                  {" · "}
                  {new Date(r.created_at).toLocaleDateString("es-AR")}
                </p>
                {r.reason && (
                  <p className="mt-1 text-xs text-ink">Motivo: {r.reason}</p>
                )}
              </div>
            </div>

            {r.post && (
              <div className="rounded-lg bg-bg p-2">
                <p className="truncate text-xs text-ink">{r.post.caption ?? "(sin texto)"}</p>
                {r.post.media_url && (
                  <p className="mt-1 text-[10px] text-muted">Tiene multimedia adjunta</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => deletePost(r)}
                disabled={busy === r.id}
                className="flex items-center gap-1 rounded-lg bg-ember/15 px-3 py-1.5 text-[11px] font-semibold text-ember"
              >
                {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Eliminar post
              </button>
              <button
                onClick={() => dismissReport(r)}
                disabled={busy === r.id}
                className="flex items-center gap-1 rounded-lg border border-edge px-3 py-1.5 text-[11px] font-semibold text-muted"
              >
                <XCircle className="h-3 w-3" /> Descartar
              </button>
            </div>
          </div>
        ))
      )}
    </main>
  );
}
