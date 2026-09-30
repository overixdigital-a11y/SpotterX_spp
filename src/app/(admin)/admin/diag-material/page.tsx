"use client";

/**
 * DIAGNOSTICO TEMPORAL - Lote 42c. Borrar cuando la prueba cross-tab este hecha.
 *
 * Verifica en vivo el fix del material propio entre pestanas sin necesitar dos
 * cuentas ni un alumno con rutina (el admin no tiene ninguno: los 7 vinculos de
 * `trainer_students` son de otro profe).
 *
 * Esta pagina arma la suscripcion realtime (`loadExerciseMediaMap` ->
 * `ensureRealtime`) y muestra el estado del store. El numero de "Actualizaciones
 * en vivo" es la senal que importa: si sube, llego el evento de `exercises`, el
 * store se refresco y los listeners se dispararon. No hay que adivinar si una
 * miniatura cambio.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import ExerciseThumb from "@/components/training/ExerciseThumb";
import {
  getExerciseMediaMap,
  loadExerciseMediaMap,
  subscribeExerciseMedia,
} from "@/lib/exercise-media-map";
import { normalizeExerciseName } from "@/lib/exercise-images";

// Ejercicios que existen en el catalogo y NO tienen foto propia, para que la
// diferencia sea obvia al subir una.
const NOMBRES = [
  "Sentadilla",
  "Press de banca",
  "Remo con barra",
  "Flexiones de brazos",
  "Dominadas",
  "Aperturas con mancuernas",
];

export default function DiagMaterialPage() {
  const map = useSyncExternalStore(
    subscribeExerciseMedia,
    getExerciseMediaMap,
    getExerciseMediaMap
  );

  const [ticks, setTicks] = useState(0);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    let active = true;
    const unsub = subscribeExerciseMedia(() => {
      if (active) setTicks((t) => t + 1);
    });
    (async () => {
      await loadExerciseMediaMap();
      if (active) setCargado(true);
    })();
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const conMaterial = Object.keys(map).length;

  return (
    <main className="p-4 md:p-6">
      <h1 className="text-lg font-bold text-ink">Diagnostico: material entre pestanas</h1>
      <p className="mt-1 text-sm text-muted">
        Dejá esta pestaña abierta. En otra pestaña subí una foto desde
        /admin/catalogo y volvé acá sin recargar.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-edge bg-card p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">Store cargado</p>
          <p className="text-sm font-semibold text-ink">{cargado ? "si" : "no"}</p>
        </div>
        <div className="rounded-lg border border-edge bg-card p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            Actualizaciones en vivo
          </p>
          <p className="text-sm font-semibold text-neon">{ticks}</p>
        </div>
        <div className="rounded-lg border border-edge bg-card p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            Ejercicios con material
          </p>
          <p className="text-sm font-semibold text-ink">{conMaterial}</p>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-edge">
        {NOMBRES.map((name) => {
          const media = map[normalizeExerciseName(name)];
          const n = media?.fotos?.length ?? 0;
          return (
            <li key={name} className="flex items-center gap-3 py-2">
              <ExerciseThumb name={name} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{name}</p>
                <p className="text-xs text-muted">
                  {n > 0
                    ? `material propio: SI (${n} foto${n > 1 ? "s" : ""}${media?.video ? " + video" : ""})`
                    : "material propio: NO"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}