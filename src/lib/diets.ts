export interface DietItemData {
  meal: string | null;
  qty: string | null;
  unit: string | null;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
}

export const MEALS: { id: string; label: string }[] = [
  { id: "desayuno", label: "Desayuno" },
  { id: "colacion", label: "Colación" },
  { id: "almuerzo", label: "Almuerzo" },
  { id: "merienda", label: "Merienda" },
  { id: "cena", label: "Cena" },
  { id: "post_entreno", label: "Post-entreno" },
];

export function mealLabel(id: string | null): string | null {
  return MEALS.find((m) => m.id === id)?.label ?? null;
}

export function getDietData(data: Record<string, unknown> | null | undefined): DietItemData {
  return {
    meal: typeof data?.meal === "string" ? data.meal : null,
    qty: typeof data?.qty === "string" ? data.qty : null,
    unit: typeof data?.unit === "string" ? data.unit : null,
    kcal: typeof data?.kcal === "number" ? data.kcal : null,
    protein_g: typeof data?.protein_g === "number" ? data.protein_g : null,
    fat_g: typeof data?.fat_g === "number" ? data.fat_g : null,
    carbs_g: typeof data?.carbs_g === "number" ? data.carbs_g : null,
  };
}