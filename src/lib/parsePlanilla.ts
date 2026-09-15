import * as XLSX from "xlsx";

interface PlanillaRow {
  full_name: string;
  email: string;
  username: string;
  role: "alumno" | "profesor";
  plan_name?: string;
}

export async function parsePlanilla(
  file: File
): Promise<PlanillaRow[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    const text = await file.text();
    return parseCSV(text);
  }

  if (ext === "xlsx" || ext === "xls") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    return json.map((row) => mapRow(row)).filter((r) => r.full_name && r.email);
  }

  return [];
}

function parseCSV(text: string): PlanillaRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  return lines
    .slice(1)
    .map((line) => {
      const cols = line
        .split(",")
        .map((c) => c.trim().replace(/^"|"$/g, ""));
      return mapRow({
        nombre: cols[0],
        email: cols[1],
        telefono: cols[2],
        plan: cols[3],
        rol: cols[4],
      });
    })
    .filter((r) => r.full_name && r.email);
}

function mapRow(row: Record<string, unknown>): PlanillaRow {
  const email = String(row.email ?? row.Email ?? row.EMAIL ?? "").trim();
  const fullName = String(
    row.full_name ?? row.nombre ?? row.Nombre ?? row["Full Name"] ?? ""
  ).trim();
  const rol = String(row.rol ?? row.role ?? row.Rol ?? "alumno")
    .toLowerCase()
    .includes("profe")
    ? "profesor"
    : "alumno";
  const plan = String(
    row.plan ?? row.Plan ?? row.plan_name ?? ""
  ).trim() || undefined;

  return {
    full_name: fullName,
    email,
    username:
      email.split("@")[0] ||
      `user_${Math.random().toString(36).slice(2, 6)}`,
    role: rol,
    plan_name: plan,
  };
}
