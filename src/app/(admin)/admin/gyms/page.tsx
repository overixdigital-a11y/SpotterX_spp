"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Users, MapPin, Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parsePlanilla } from "@/lib/parsePlanilla";

const INVITE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/invite-member";

interface GymRow {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  owner_id: string;
  created_at: string;
  member_count?: number;
}

interface ImportResult {
  ok?: boolean;
  user_id?: string;
  provisional_password?: string;
  existed?: boolean;
  email?: string;
  error?: string;
}

export default function AdminGymsPage() {
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importGymId, setImportGymId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("gyms")
        .select("id, name, city, address, owner_id, created_at")
        .order("created_at", { ascending: false });
      if (!data) {
        setLoading(false);
        return;
      }

      const gymIds = data.map((g) => g.id);
      const { data: memberships } = await supabase
        .from("gym_memberships")
        .select("gym_id")
        .eq("status", "activa")
        .in("gym_id", gymIds);

      const countMap = new Map<string, number>();
      memberships?.forEach((m) => {
        countMap.set(m.gym_id, (countMap.get(m.gym_id) ?? 0) + 1);
      });

      setGyms(
        data.map((g) => ({ ...g, member_count: countMap.get(g.id) ?? 0 }))
      );
      setLoading(false);
    };
    load();
  }, []);

  const handleFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    gymId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportGymId(gymId);
    setImporting(true);
    setImportResults(null);
    setImportSummary(null);

    try {
      const rows = await parsePlanilla(file);
      if (rows.length === 0) {
        alert("No se encontraron filas válidas en el archivo.");
        setImporting(false);
        setImportGymId(null);
        return;
      }
      if (!confirm(`¿Importar ${rows.length} miembros a este gym?`)) {
        setImporting(false);
        setImportGymId(null);
        return;
      }

      const supa = createClient();
      const token = (
        await supa.auth.getSession()
      ).data.session?.access_token;
      const res = await fetch(INVITE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gym_id: gymId, users: rows, as_admin: true }),
      });
      const data = await res.json();
      if (data.error) {
        setImportSummary(`Error: ${data.error}`);
      } else {
        const results: ImportResult[] = data.results ?? [data];
        setImportResults(results);
        const created = results.filter((r) => r.ok && !r.existed).length;
        const existed = results.filter((r) => r.existed).length;
        const errors = results.filter((r) => !r.ok).length;
        setImportSummary(
          `Listo: ${created} creados, ${existed} ya existentes${
            errors > 0 ? `, ${errors} errores` : ""
          }`
        );
      }
    } catch {
      setImportSummary("Error de red al importar.");
    }
    setImporting(false);
    e.target.value = "";
  };

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
        {gyms.length} gimnasio{gyms.length !== 1 ? "s" : ""}
      </p>

      {gyms.length === 0 ? (
        <div className="py-16 text-center">
          <Dumbbell className="mx-auto mb-3 h-8 w-8 text-[#6b7280]" />
          <p className="text-sm text-[#6b7280]">No hay gyms registrados</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#1e2530]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#0c1017]">
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">
                  Gym
                </th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] sm:table-cell">
                  Ubicación
                </th>
                <th className="hidden px-4 py-2.5 text-xs font-medium text-[#9ca3af] sm:table-cell">
                  Miembros
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-[#9ca3af]">
                  Importar
                </th>
              </tr>
            </thead>
            <tbody>
              {gyms.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-[#1e2530]/50 last:border-0 hover:bg-[#121722]/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316]/10">
                        <Dumbbell className="h-4 w-4 text-[#f97316]" />
                      </div>
                      <span className="text-sm font-medium text-[#e4e8ee]">
                        {g.name}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {g.city && (
                      <span className="flex items-center gap-1 text-xs text-[#9ca3af]">
                        <MapPin className="h-3 w-3" /> {g.city}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="flex items-center gap-1 text-xs text-[#9ca3af]">
                      <Users className="h-3 w-3" /> {g.member_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#f97316]/10 px-3 py-1.5 text-[11px] font-medium text-[#f97316] hover:bg-[#f97316]/20">
                      {importing && importGymId === g.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      {importing && importGymId === g.id
                        ? "Importando..."
                        : "Planilla"}
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => handleFile(e, g.id)}
                        disabled={importing}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importSummary && (
        <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
          <p className="text-sm font-medium text-[#e4e8ee]">{importSummary}</p>
        </div>
      )}

      {importResults && importResults.length > 0 && (
        <div className="rounded-lg border border-[#1e2530] bg-[#121722] p-4">
          <p className="mb-2 text-xs font-medium text-[#9ca3af]">
            Resultados detallados
          </p>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {importResults.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs ${
                  r.ok
                    ? r.existed
                      ? "bg-[#9ca3af]/10 text-[#9ca3af]"
                      : "bg-[#00e5c7]/10 text-[#00e5c7]"
                    : "bg-[#ef4444]/10 text-[#ef4444]"
                }`}
              >
                <span>{r.email}</span>
                <span>
                  {r.ok
                    ? r.existed
                      ? "Ya existía"
                      : r.provisional_password
                        ? `Clave: ${r.provisional_password}`
                        : "Creado"
                    : r.error}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
