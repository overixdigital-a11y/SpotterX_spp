"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { autocompleteCity, ARG_PROVINCIAS, CitySuggestion } from "@/lib/geo";

interface Props {
  province: string;
  city: string;
  withLabels?: boolean;
  onChange: (patch: {
    province: string;
    city: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  }) => void;
}

const inputCls =
  "w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none";

const labelCls = "mb-1 block text-xs font-semibold text-muted";

export default function ProvinceCityFields({ province, city, withLabels = false, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = city.trim();
    if (t.length < 3) {
      const id = setTimeout(() => {
        setSuggestions([]);
        setSearching(false);
        setOpen(false);
      }, 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(async () => {
      setSearching(true);
      setOpen(true);
      const list = await autocompleteCity(t);
      setSuggestions(list);
      setSearching(false);
    }, 300);
    return () => clearTimeout(id);
  }, [city]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="space-y-2">
      {withLabels && <label className={labelCls}>Provincia</label>}
      <select
        value={province}
        onChange={(e) => onChange({ province: e.target.value, city })}
        className={inputCls}
      >
        <option value="">Provincia…</option>
        {ARG_PROVINCIAS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      {withLabels && <label className={labelCls}>Ciudad / Barrio</label>}
      <div ref={wrapRef} className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          value={city}
          onChange={(e) => {
            onChange({ province, city: e.target.value });
            setOpen(false);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Ciudad / barrio (ej: Córdoba, Centro)"
          className={`${inputCls} pl-8`}
        />
        {open && (searching || suggestions.length > 0) && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-edge bg-elevated shadow-xl">
            {searching && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
              </div>
            )}
            {suggestions.map((s, i) => (
              <button
                key={`${s.name}-${i}`}
                type="button"
                className="flex w-full items-start gap-2 border-b border-edge px-3 py-2 text-left transition hover:bg-bg"
                onClick={() => {
                  onChange({
                    province: s.province ?? province,
                    city: s.name,
                    postalCode: s.postalCode ?? "",
                    latitude: s.lat,
                    longitude: s.lng,
                  });
                  setOpen(false);
                }}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                  <span className="block truncate text-xs text-muted">{s.label}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}