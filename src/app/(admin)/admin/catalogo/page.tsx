"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dumbbell,
  UtensilsCrossed,
  Trash2,
  Loader2,
  Pencil,
  Plus,
  X,
  ImagePlus,
  Copy,
  Video,
  VideoOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useToast } from "@/components/core/ToastProvider";
import { exerciseImage } from "@/lib/exercise-images";
import { resetExerciseMediaMap, mediaPathFromUrl } from "@/lib/exercise-media-map";
import { resetExerciseCatalogCache } from "@/components/training/ExercisePicker";
import { resetFoodCatalogCache } from "@/components/training/FoodPicker";
import { DISCIPLINES } from "@/lib/disciplines";
import { MUSCLE_ORDER, FOOD_CATEGORY_ORDER, findEquivalentExercise } from "@/lib/catalog";

type Tab = "ejercicios" | "alimentos";

interface Exercise {
  id: string;
  name: string;
  muscle: string | null;
  discipline: string | null;
  image_urls: string[];
  demo_url: string | null;
}

interface Food {
  id: string;
  name: string;
  category: string;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  unit_grams: number | null;
}

type PhotoFilter = "todas" | "sin" | "propia";

const input =
  "w-full rounded-lg border border-[#1e2530] bg-[#121722] px-3 py-2.5 text-sm text-[#e4e8ee] placeholder:text-[#6b7280] focus:border-[#00e5c7]/50 focus:outline-none";
const label = "mb-1 block text-xs font-medium text-[#9ca3af]";
const btnGhost =
  "rounded-md px-2.5 py-1.5 text-xs font-medium text-[#9ca3af] hover:bg-[#1a1f2e] hover:text-[#e4e8ee] disabled:opacity-50";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-md bg-[#00e5c7]/10 px-3 py-2 text-xs font-medium text-[#00e5c7] hover:bg-[#00e5c7]/20 disabled:opacity-50";
const th = "px-4 py-2.5 text-xs font-medium text-[#9ca3af]";
const td = "px-4 py-2.5 text-sm";

const MIGRATION_HINT =
  "Falta correr la migracion 00049 en Supabase (SQL Editor). Sin ella no se pueden guardar fotos, videos, editar ni agregar desde aca.";

/** Tope de fotos por ejercicio. El mismo limite esta en la RPC (00049). */
const MAX_PHOTOS = 5;

/**
 * Tope del video demo. No se recomprime en el celu (el browser no lo hace bien):
 * se avisa y el admin exporta el clip liviano. 8 MB es el default del bucket
 * `media`, asi que hay que subirlos al limite de todos modos.
 */
const MAX_VIDEO_MB = 8;

/** Convierte el error de la RPC en algo que se pueda leer. */
function readableError(message: string): string {
  if (/could not find the function|does not exist/i.test(message)) return MIGRATION_HINT;
  if (/duplicate key|exercises_name_unique|foods_name_unique/i.test(message)) {
    return "Ya existe un ejercicio o alimento con ese nombre.";
  }
  return message.replace(/^.*?:\s*/, "") || "No se pudo completar la operacion.";
}

export default function AdminCatalogoPage() {
  const { userId } = useAuthState();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("ejercicios");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("todas");
  const [needsMigration, setNeedsMigration] = useState(false);

  // Formulario: null = cerrado. `__nuevo__` = agregar.
  const [form, setForm] = useState<{ mode: "nuevo" | "editar"; id: string | null } | null>(null);
  const [fname, setFname] = useState("");
  const [fgroup, setFgroup] = useState("");
  const [fdisc, setFdisc] = useState("");
  const [fcat, setFcat] = useState("");
  const [fnums, setFnums] = useState({ kcal: "", protein: "", fat: "", carbs: "", grams: "" });

  // Un input de archivo por ejercicio y por tipo (foto / video). Se guardan en
  // refs para disparar el dialogo nativo del celu.
  const photoRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const videoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    const supabase = createClient();
    const [exRes, foodRes] = await Promise.all([
      supabase
        .from("exercises")
        .select("id, name, muscle, discipline, image_urls, demo_url")
        .order("name"),
      supabase
        .from("foods")
        .select("id, name, category, kcal, protein_g, fat_g, carbs_g, unit_grams")
        .order("name"),
    ]);

    // Sin las columnas image_urls/demo_url la query entera falla: se avisa en
    // vez de mostrar un catalogo vacio sin explicacion.
    setNeedsMigration(
      Boolean(exRes.error && /image_urls|demo_url|column/i.test(exRes.error.message))
    );

    if (!exRes.error && exRes.data) {
      // `image_urls` es `not null` pero igual se normaliza: si la columna no
      // existe todavia la query no llega aca, y si llega en null (fila vieja
      // migrada a mano) la lista quedaria con `null.length` => reventon.
      setExercises(
        (exRes.data as unknown as (Omit<Exercise, "image_urls"> & {
          image_urls: string[] | null;
        })[]).map((r) => ({
          ...r,
          image_urls: Array.isArray(r.image_urls) ? r.image_urls.filter(Boolean) : [],
        }))
      );
    }
    if (!foodRes.error && foodRes.data) setFoods(foodRes.data as Food[]);
    setLoading(false);
  }, []);

  /**
   * Un cambio en el admin tiene que verse en el resto de la app sin que el
   * usuario recargue: el material propio, la lista de ejercicios y la de
   * alimentos viven en caches de modulo, no en estado de componente.
   */
  const invalidate = () => {
    resetExerciseMediaMap();
    resetExerciseCatalogCache();
    resetFoodCatalogCache();
  };

  useEffect(() => {
    // Patron del repo (Lote 38): NO llamar `load()` directo en el cuerpo del
    // efecto, porque dispara la regla react-hooks/set-state-in-effect. La IIFE
    // + flag `active` ademas evita pintar datos si el componente se desmonta.
    let active = true;
    (async () => {
      await load();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [load]);

  // ---------------------------------------------------------------- form
  const openNew = () => {
    setForm({ mode: "nuevo", id: null });
    setFname("");
    setFgroup("");
    setFdisc("");
    setFcat(FOOD_CATEGORY_ORDER[0]);
    setFnums({ kcal: "", protein: "", fat: "", carbs: "", grams: "" });
  };

  const openEditExercise = (e: Exercise) => {
    setForm({ mode: "editar", id: e.id });
    setFname(e.name);
    setFgroup(e.muscle ?? "");
    setFdisc(e.discipline ?? "");
    setFcat("");
    setFnums({ kcal: "", protein: "", fat: "", carbs: "", grams: "" });
  };

  const openEditFood = (f: Food) => {
    setForm({ mode: "editar", id: f.id });
    setFname(f.name);
    setFgroup("");
    setFcat(f.category);
    setFnums({
      kcal: f.kcal == null ? "" : String(f.kcal),
      protein: f.protein_g == null ? "" : String(f.protein_g),
      fat: f.fat_g == null ? "" : String(f.fat_g),
      carbs: f.carbs_g == null ? "" : String(f.carbs_g),
      grams: f.unit_grams == null ? "" : String(f.unit_grams),
    });
  };

  const closeForm = () => setForm(null);

  // ------------------------------------------------------------- guardar
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const usage = async (kind: "exercise" | "food", name: string) => {
    const { data, error } = await createClient().rpc("admin_catalog_usage", {
      p_kind: kind,
      p_name: name,
    });
    if (error) throw new Error(readableError(error.message));
    const u = (data ?? {}) as { routines?: number; plans?: number };
    return { routines: u.routines ?? 0, plans: u.plans ?? 0 };
  };

  const describeUsage = (kind: "exercise" | "food", u: { routines: number; plans: number }) => {
    const parts: string[] = [];
    if (u.routines > 0) parts.push(`${u.routines} rutina${u.routines > 1 ? "s" : ""}`);
    if (u.plans > 0) parts.push(`${u.plans} ${kind === "food" ? "dieta" : "plan"}${u.plans > 1 ? "s" : ""}`);
    return parts.join(" y ");
  };

  const submit = async () => {
    const name = fname.trim();
    if (!name) {
      toast("Ponele un nombre", "error");
      return;
    }
    const isFood = tab === "alimentos";
    setBusy("form");
    try {
      const supabase = createClient();

      // --- agregar (la base ya permite crear; no hace falta RPC) ---------
      if (form?.mode === "nuevo") {
        if (isFood) {
          const { error } = await supabase.from("foods").insert({
            name,
            category: fcat,
            kcal: num(fnums.kcal) ?? 0,
            protein_g: num(fnums.protein) ?? 0,
            fat_g: num(fnums.fat) ?? 0,
            carbs_g: num(fnums.carbs) ?? 0,
            unit_grams: num(fnums.grams),
            created_by: userId,
          });
          if (error) throw new Error(readableError(error.message));
        } else {
          const { error } = await supabase.from("exercises").insert({
            name,
            muscle: fgroup || null,
            discipline: fdisc || null,
            created_by: userId,
          });
          if (error) throw new Error(readableError(error.message));
        }
        toast(`"${name}" agregado`);
        closeForm();
        invalidate();
        await load();
        return;
      }

      // --- editar -------------------------------------------------------
      if (!form?.id) return;
      const current = isFood
        ? foods.find((f) => f.id === form.id)
        : exercises.find((e) => e.id === form.id);
      if (!current) return;

      const renamed = name.toLowerCase() !== current.name.trim().toLowerCase();
      let cascade = false;
      if (renamed) {
        const u = await usage(isFood ? "food" : "exercise", current.name);
        const total = u.routines + u.plans;
        if (total > 0) {
          const where = describeUsage(isFood ? "food" : "exercise", u);
          if (!confirm(`"${current.name}" se esta usando en ${where}.\n\nSi le cambias el nombre, tambien actualizo ${where} para que no queden con el nombre viejo.\n\n¿Continuar?`)) {
            setBusy(null);
            return;
          }
          cascade = true;
        }
      }

      if (isFood) {
        const { error } = await supabase.rpc("admin_update_food", {
          p_id: form.id,
          p_name: name,
          p_category: fcat,
          p_kcal: num(fnums.kcal),
          p_protein_g: num(fnums.protein),
          p_fat_g: num(fnums.fat),
          p_carbs_g: num(fnums.carbs),
          p_unit_grams: num(fnums.grams),
          p_cascade: cascade,
        });
        if (error) throw new Error(readableError(error.message));
      } else {
        const { error } = await supabase.rpc("admin_update_exercise", {
          p_id: form.id,
          p_name: name,
          p_muscle: fgroup,
          p_discipline: fdisc,
          p_cascade: cascade,
        });
        if (error) throw new Error(readableError(error.message));
      }

      toast(renamed ? `"${current.name}" ahora es "${name}"` : "Cambios guardados");
      closeForm();
      invalidate();
      await load();
    } catch (err) {
      toast(readableError(err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setBusy(null);
    }
  };

  // ------------------------------------------------------- material
  const pickPhoto = (id: string) => photoRefs.current[id]?.click();
  const pickVideo = (id: string) => videoRefs.current[id]?.click();

  /** Escribe fotos + video de un ejercicio y refresca la fila en la tabla. */
  const saveMedia = async (id: string, fotos: string[], video: string | null) => {
    const { error } = await createClient().rpc("admin_set_exercise_media", {
      p_exercise_id: id,
      p_image_urls: fotos,
      p_demo_url: video,
    });
    if (error) throw new Error(readableError(error.message));
    // La app lee el mapa desde memoria: hay que invalidarlo para que las rutinas
    // muestren el material nuevo sin recargar.
    invalidate();
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, image_urls: fotos, demo_url: video } : e))
    );
  };

  /**
   *BORra el archivo de Storage de una URL, salvo que OTRA fila la siga
   * usando. Esto importa por el boton "copiar a Nordic curl": las dos filas
   * quedan apuntando al MISMO objeto, y borrar el de una dejaria a la otra
   * apuntando al vacio.
   */
  const purgeObject = async (url: string, exceptExerciseId: string) => {
    const path = mediaPathFromUrl(url);
    if (!path) return;
    const stillUsed = exercises.some(
      (e) =>
        e.id !== exceptExerciseId &&
        (e.image_urls.includes(url) || e.demo_url === url)
    );
    if (stillUsed) return;
    await createClient().storage.from("media").remove([path]);
  };

  const uploadPhoto = async (ex: Exercise, file: File | null) => {
    if (!file) return;
    if (!userId) {
      toast("No se pudo identificar tu usuario", "error");
      return;
    }
    if (ex.image_urls.length >= MAX_PHOTOS) {
      toast(`Maximo ${MAX_PHOTOS} fotos por ejercicio`, "error");
      return;
    }
    setBusy(`photo:${ex.id}`);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/ejercicios/${ex.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      await saveMedia(ex.id, [...ex.image_urls, pub.publicUrl], ex.demo_url);
      toast(
        ex.image_urls.length === 0
          ? `Foto de "${ex.name}" guardada`
          : `Foto agregada (${ex.image_urls.length + 1}/${MAX_PHOTOS})`
      );
    } catch (err) {
      toast(readableError(err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async (ex: Exercise, url: string) => {
    const quedan = ex.image_urls.length - 1;
    if (
      !confirm(
        quedan > 0
          ? `¿Quitar esta foto de "${ex.name}"?\n\nQuedan ${quedan}. La primera es la que se ve en la lista.`
          : `¿Quitar la foto de "${ex.name}"?\n\nVuelve a la que trae la app, si tenia.`
      )
    )
      return;
    setBusy(`photo:${ex.id}`);
    try {
      const fotos = ex.image_urls.filter((u) => u !== url);
      await saveMedia(ex.id, fotos, ex.demo_url);
      await purgeObject(url, ex.id);
      toast("Foto quitada");
    } catch (err) {
      toast(readableError(err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setBusy(null);
    }
  };

  const uploadVideo = async (ex: Exercise, file: File | null) => {
    if (!file) return;
    if (!userId) {
      toast("No se pudo identificar tu usuario", "error");
      return;
    }
    if (!/^video\/(mp4|webm)$/i.test(file.type)) {
      toast("El video tiene que ser MP4 o WebM", "error");
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast(
        `El video pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el maximo es ${MAX_VIDEO_MB} MB. ` +
          `Exportalo a 720p (en el celu: Compartir -> Guardar en archivos ->Guardar como -> Pelicula 720p).`,
        "error"
      );
      return;
    }
    setBusy(`video:${ex.id}`);
    try {
      const supabase = createClient();
      const ext = file.type === "video/webm" ? "webm" : "mp4";
      const path = `${userId}/ejercicios-video/${ex.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      const anterior = ex.demo_url;
      await saveMedia(ex.id, ex.image_urls, pub.publicUrl);
      if (anterior) await purgeObject(anterior, ex.id);
      toast(`Video de "${ex.name}" guardado`);
    } catch (err) {
      toast(readableError(err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setBusy(null);
    }
  };

  const removeVideo = async (ex: Exercise) => {
    if (!confirm(`¿Quitar el video de "${ex.name}"?`)) return;
    setBusy(`video:${ex.id}`);
    try {
      const anterior = ex.demo_url;
      await saveMedia(ex.id, ex.image_urls, null);
      if (anterior) await purgeObject(anterior, ex.id);
      toast("Video quitado");
    } catch (err) {
      toast(readableError(err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setBusy(null);
    }
  };

  /** Copia fotos + video al otro nombre del mismo movimiento (es/en). */
  const copyToTwin = async (ex: Exercise, twinName: string) => {
    setBusy(`photo:${ex.id}`);
    try {
      const twin = exercises.find(
        (e) => e.name.trim().toLowerCase() === twinName.trim().toLowerCase()
      );
      if (!twin) throw new Error(`No encontre "${twinName}" en el catalogo`);
      const fotos = ex.image_urls.slice(0, MAX_PHOTOS);
      await saveMedia(twin.id, fotos, ex.demo_url);
      toast(`Material copiado a "${twin.name}"`);
    } catch (err) {
      toast(readableError(err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setBusy(null);
    }
  };

  // -------------------------------------------------------------- borrar
  const remove = async (kind: Tab, row: Exercise | Food) => {
    setBusy(`del:${row.id}`);
    try {
      let warn = "";
      try {
        const u = await usage(kind === "ejercicios" ? "exercise" : "food", row.name);
        const where = describeUsage(kind === "ejercicios" ? "exercise" : "food", u);
        if (where) {
          warn = `\n\nEsta en uso en ${where}. Las rutinas quedan con el nombre escrito y, si tenia fotos o video propios, los pierden.`;
        }
      } catch {
        // si no se puede medir el uso, se borra igual (el borrado va por RPC admin)
      }
      if (!confirm(`¿Eliminar "${row.name}"?${warn}`)) {
        setBusy(null);
        return;
      }
      // Los archivos de Storage no los borra la RPC (esta no sabe de buckets):
      // se limpian aca, antes de que la fila desaparezca del estado.
      if (kind === "ejercicios") {
        const ex = row as Exercise;
        for (const url of [...ex.image_urls, ex.demo_url].filter(Boolean) as string[]) {
          try {
            await purgeObject(url, ex.id);
          } catch {
            // un archivo huerfano no puede bloquear el borrado de la fila
          }
        }
      }
      const supabase = createClient();
      const { error } =
        kind === "ejercicios"
          ? await supabase.rpc("admin_delete_exercise", { p_exercise_id: row.id })
          : await supabase.rpc("admin_delete_food", { p_food_id: row.id });
      if (error) throw new Error(readableError(error.message));
      invalidate();
      if (kind === "ejercicios") setExercises((prev) => prev.filter((e) => e.id !== row.id));
      else setFoods((prev) => prev.filter((f) => f.id !== row.id));
      toast("Eliminado");
    } catch (err) {
      toast(readableError(err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setBusy(null);
    }
  };

  // --------------------------------------------------------------- filtro
  const q = search.trim().toLowerCase();
  const hasOwn = (e: Exercise) => e.image_urls.length > 0 || Boolean(e.demo_url);
  const hasAny = (e: Exercise) => hasOwn(e) || Boolean(exerciseImage(e.name));

  const visibleExercises = exercises.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q) && !e.muscle?.toLowerCase().includes(q)) return false;
    if (photoFilter === "sin") return !hasAny(e);
    if (photoFilter === "propia") return hasOwn(e);
    return true;
  });

  const visibleFoods = foods.filter((f) => {
    if (!q) return true;
    return f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
  });

  const missing = exercises.filter((e) => !hasAny(e)).length;
  const withOwn = exercises.filter(hasOwn).length;

  const isOpen = form !== null;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ pestañas */}
      <div className="flex gap-2">
        {(
          [
            ["ejercicios", "Ejercicios", Dumbbell, exercises.length],
            ["alimentos", "Alimentos", UtensilsCrossed, foods.length],
          ] as const
        ).map(([key, text, Icon, count]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setSearch("");
              setPhotoFilter("todas");
              closeForm();
            }}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === key
                ? key === "ejercicios"
                  ? "bg-[#00e5c7]/10 text-[#00e5c7]"
                  : "bg-[#f97316]/10 text-[#f97316]"
                : "text-[#9ca3af] hover:bg-[#1a1f2e]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {text} ({count})
          </button>
        ))}
      </div>

      {needsMigration && (
        <div className="rounded-lg border border-[#f97316]/40 bg-[#f97316]/10 px-4 py-3 text-xs text-[#f97316]">
          {MIGRATION_HINT}
        </div>
      )}

      {/* ------------------------------------------------------- buscador */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar ${tab}...`}
          className={`${input} flex-1`}
        />
        <div className="flex gap-2">
          {tab === "ejercicios" && (
            <>
              <button
                onClick={openNew}
                className={btnPrimary}
                disabled={needsMigration}
              >
                <Plus className="h-3.5 w-3.5" /> Agregar
              </button>
              <select
                value={photoFilter}
                onChange={(e) => setPhotoFilter(e.target.value as PhotoFilter)}
                className="rounded-lg border border-[#1e2530] bg-[#121722] px-2.5 py-2 text-xs text-[#e4e8ee] focus:border-[#00e5c7]/50 focus:outline-none"
              >
                <option value="todas">Todas ({exercises.length})</option>
                <option value="sin">Sin material ({missing})</option>
                <option value="propia">Con material propio ({withOwn})</option>
              </select>
            </>
          )}
          {tab === "alimentos" && (
            <button onClick={openNew} className={btnPrimary} disabled={needsMigration}>
              <Plus className="h-3.5 w-3.5" /> Agregar
            </button>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- form */}
      {isOpen && (
        <div className="space-y-3 rounded-lg border border-[#00e5c7]/30 bg-[#0c1017] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#e4e8ee]">
              {form.mode === "nuevo" ? "Agregar" : "Modificar"}{" "}
              {tab === "ejercicios" ? "ejercicio" : "alimento"}
            </h3>
            <button onClick={closeForm} className={btnGhost}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className={label}>Nombre *</span>
              <input
                value={fname}
                onChange={(e) => setFname(e.target.value)}
                placeholder={tab === "ejercicios" ? "ej: Burpees" : "ej: Banana"}
                className={input}
              />
            </div>

            {tab === "ejercicios" ? (
              <>
                <div>
                  <span className={label}>Grupo muscular</span>
                  <select
                    value={fgroup}
                    onChange={(e) => setFgroup(e.target.value)}
                    className={input}
                  >
                    <option value="">Sin grupo</option>
                    {MUSCLE_ORDER.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={label}>Disciplina sugerida</span>
                  <select
                    value={fdisc}
                    onChange={(e) => setFdisc(e.target.value)}
                    className={input}
                  >
                    <option value="">Sin disciplina</option>
                    {DISCIPLINES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className={label}>Categoria</span>
                  <select value={fcat} onChange={(e) => setFcat(e.target.value)} className={input}>
                    {FOOD_CATEGORY_ORDER.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {(
                    [
                      ["kcal", "kcal/100g"],
                      ["protein", "Proteina g"],
                      ["fat", "Grasa g"],
                      ["carbs", "Carbo g"],
                      ["grams", "1 unidad = g"],
                    ] as const
                  ).map(([key, text]) => (
                    <div key={key}>
                      <span className={label}>{text}</span>
                      <input
                        inputMode="decimal"
                        value={fnums[key]}
                        onChange={(e) => setFnums((p) => ({ ...p, [key]: e.target.value }))}
                        className={input}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {form.mode === "editar" && (
            <p className="text-[11px] text-[#6b7280]">
              Macros por 100 g. Si el nombre esta en uso te va a avisar antes de cambiarlo.
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={submit} disabled={busy === "form"} className={btnPrimary}>
              {busy === "form" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar
            </button>
            <button onClick={closeForm} className={btnGhost}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- tabla */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#00e5c7]" />
        </div>
      ) : tab === "ejercicios" ? (
        <div className="overflow-x-auto rounded-lg border border-[#1e2530]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#0c1017]">
                <th className={th}>Fotos</th>
                <th className={th}>Video</th>
                <th className={th}>Nombre</th>
                <th className={`hidden ${th} sm:table-cell`}>Grupo</th>
                <th className={`hidden ${th} sm:table-cell`}>Disciplina</th>
                <th className={th}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {visibleExercises.map((e) => {
                const twinName = findEquivalentExercise(e.name);
                const twin = twinName
                  ? exercises.find(
                      (x) => x.name.trim().toLowerCase() === twinName.trim().toLowerCase()
                    )
                  : null;
                const showCopy = Boolean(
                  hasOwn(e) && twin && !hasOwn(twin)
                );
                return (
                  <tr
                    key={e.id}
                    className="border-b border-[#1e2530]/50 last:border-0 hover:bg-[#121722]/50"
                  >
                    {/* fotos: hasta MAX_PHOTOS, la primera es la portada */}
                    <td className={td}>
                      <div className="flex flex-wrap items-center gap-1">
                        {e.image_urls.map((u) => (
                          <span key={u} className="relative inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={u}
                              alt=""
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-md object-cover"
                            />
                            <button
                              onClick={() => void removePhoto(e, u)}
                              disabled={busy === `photo:${e.id}`}
                              title="Quitar esta foto"
                              className="absolute -right-1 -top-1 rounded-full bg-[#0c1017] p-0.5 text-[#9ca3af] hover:text-[#ef4444] disabled:opacity-50"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {e.image_urls.length < MAX_PHOTOS && (
                          <button
                            onClick={() => pickPhoto(e.id)}
                            disabled={busy === `photo:${e.id}` || needsMigration}
                            title={`Agregar foto (${e.image_urls.length}/${MAX_PHOTOS})`}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-[#1e2530] text-[#6b7280] hover:border-[#00e5c7]/50 hover:text-[#00e5c7] disabled:opacity-50"
                          >
                            {busy === `photo:${e.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ImagePlus className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {e.image_urls.length === 0 && !e.demo_url && (
                          <span className="text-[10px] text-[#6b7280]">sin foto</span>
                        )}
                      </div>
                      <input
                        ref={(el) => {
                          photoRefs.current[e.id] = el;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(ev) => {
                          void uploadPhoto(e, ev.target.files?.[0] ?? null);
                          ev.target.value = "";
                        }}
                      />
                    </td>

                    {/* video demo */}
                    <td className={td}>
                      <div className="flex items-center gap-1.5">
                        {e.demo_url ? (
                          <>
                            <video
                              src={e.demo_url}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-10 w-10 shrink-0 rounded-md bg-black object-cover"
                            />
                            <button
                              onClick={() => void removeVideo(e)}
                              disabled={busy === `video:${e.id}`}
                              title="Quitar el video"
                              className="rounded-md p-1.5 text-[#9ca3af] hover:bg-[#ef4444]/10 hover:text-[#ef4444] disabled:opacity-50"
                            >
                              {busy === `video:${e.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <VideoOff className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => pickVideo(e.id)}
                            disabled={busy === `video:${e.id}` || needsMigration}
                            title={`Subir video demo (max ${MAX_VIDEO_MB} MB)`}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-[#1e2530] text-[#6b7280] hover:border-[#00e5c7]/50 hover:text-[#00e5c7] disabled:opacity-50"
                          >
                            {busy === `video:${e.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Video className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <input
                          ref={(el) => {
                            videoRefs.current[e.id] = el;
                          }}
                          type="file"
                          accept="video/mp4,video/webm"
                          className="hidden"
                          onChange={(ev) => {
                            void uploadVideo(e, ev.target.files?.[0] ?? null);
                            ev.target.value = "";
                          }}
                        />
                      </div>
                    </td>

                    <td className={`${td} font-medium text-[#e4e8ee]`}>
                      {e.name}
                      {!hasAny(e) && (
                        <span className="ml-2 rounded bg-[#1a1f2e] px-1.5 py-0.5 text-[10px] text-[#6b7280]">
                          sin material
                        </span>
                      )}
                      {showCopy && (
                        <button
                          onClick={() => void copyToTwin(e, twinName as string)}
                          disabled={busy === `photo:${e.id}`}
                          title={`Copiar las fotos y el video a "${twinName}" (es el mismo movimiento con otro nombre)`}
                          className="ml-2 inline-flex items-center gap-1 rounded bg-[#00e5c7]/10 px-1.5 py-0.5 text-[10px] text-[#00e5c7] hover:bg-[#00e5c7]/20 disabled:opacity-50"
                        >
                          <Copy className="h-2.5 w-2.5" /> copiar a &quot;{twinName}&quot;
                        </button>
                      )}
                    </td>

                    <td className={`hidden ${td} sm:table-cell`}>
                      <span className="rounded-md bg-[#1a1f2e] px-2 py-0.5 text-[11px] text-[#9ca3af]">
                        {e.muscle ?? "-"}
                      </span>
                    </td>
                    <td className={`hidden ${td} sm:table-cell text-xs text-[#9ca3af]`}>
                      {e.discipline ?? "-"}
                    </td>

                    <td className={td}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditExercise(e)}
                          disabled={needsMigration}
                          title="Modificar"
                          className="rounded-md p-1.5 text-[#9ca3af] hover:bg-[#00e5c7]/10 hover:text-[#00e5c7] disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void remove("ejercicios", e)}
                          disabled={busy === `del:${e.id}` || needsMigration}
                          title="Eliminar"
                          className="rounded-md p-1.5 text-[#9ca3af] hover:bg-[#ef4444]/10 hover:text-[#ef4444] disabled:opacity-50"
                        >
                          {busy === `del:${e.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleExercises.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-[#6b7280]">
              Ningun ejercicio coincide.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#1e2530]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2530] bg-[#0c1017]">
                <th className={th}>Nombre</th>
                <th className={`hidden ${th} sm:table-cell`}>Categoria</th>
                <th className={`hidden ${th} sm:table-cell`}>Kcal</th>
                <th className={`hidden ${th} lg:table-cell`}>P / G / C</th>
                <th className={th}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {visibleFoods.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-[#1e2530]/50 last:border-0 hover:bg-[#121722]/50"
                >
                  <td className={`${td} font-medium text-[#e4e8ee]`}>{f.name}</td>
                  <td className={`hidden ${td} sm:table-cell`}>
                    <span className="rounded-md bg-[#1a1f2e] px-2 py-0.5 text-[11px] text-[#9ca3af]">
                      {f.category}
                    </span>
                  </td>
                  <td className={`hidden ${td} sm:table-cell`}>{f.kcal ?? 0} kcal/100g</td>
                  <td className={`hidden ${td} text-xs text-[#9ca3af] lg:table-cell`}>
                    {f.protein_g ?? 0} / {f.fat_g ?? 0} / {f.carbs_g ?? 0}
                  </td>
                  <td className={td}>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditFood(f)}
                        disabled={needsMigration}
                        title="Modificar"
                        className="rounded-md p-1.5 text-[#9ca3af] hover:bg-[#f97316]/10 hover:text-[#f97316] disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void remove("alimentos", f)}
                        disabled={busy === `del:${f.id}` || needsMigration}
                        title="Eliminar"
                        className="rounded-md p-1.5 text-[#9ca3af] hover:bg-[#ef4444]/10 hover:text-[#ef4444] disabled:opacity-50"
                      >
                        {busy === `del:${f.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleFoods.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-[#6b7280]">
              Ningun alimento coincide.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
