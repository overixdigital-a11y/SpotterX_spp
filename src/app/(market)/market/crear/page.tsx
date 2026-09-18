"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { MARKET_CATEGORIES, type MarketCategory } from "@/lib/market";

export default function MarketCrearPage() {
  const { userId } = useAuthState();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "" as MarketCategory | "",
    condition: "new" as "new" | "used",
    stock: "1",
    location: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    if (files.length + newFiles.length > 5) return;
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setFiles((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const publish = async () => {
    if (!userId || !form.name.trim() || !form.price || !form.category) return;
    setSaving(true);
    const supabase = createClient();

    const imageUrls: string[] = [];
    for (const f of files) {
      const ext = f.name.split(".").pop() ?? "jpg";
      const path = `${userId}/market/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, f);
      if (!error) {
        const { data } = supabase.storage.from("media").getPublicUrl(path);
        if (data?.publicUrl) imageUrls.push(data.publicUrl);
      }
    }

    const { error } = await supabase.from("market_products").insert({
      seller_id: userId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      category: form.category,
      condition: form.condition,
      stock: Number(form.stock) || 1,
      location: form.location.trim() || null,
      images: imageUrls,
    });

    setSaving(false);
    if (!error) {
      router.push("/market");
    }
  };

  return (
    <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur">
        <button onClick={() => router.back()} className="text-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-ink">Publicar producto</h1>
      </div>

      <div className="space-y-4 p-4">
        {/* Photos */}
        <div>
          <label className="text-xs font-medium text-muted">Fotos (máx. 5)</label>
          <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
            {previews.map((src, i) => (
              <div key={i} className="relative h-20 w-20 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full rounded-lg object-cover" />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -right-1 -top-1 rounded-full bg-ember p-0.5 text-bg text-[10px]"
                >
                  ✕
                </button>
              </div>
            ))}
            {files.length < 5 && (
              <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-edge text-2xl text-muted">
                +
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFiles}
                />
              </label>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs font-medium text-muted">Nombre *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Mancuernas hexagonales 10kg"
            className="mt-1 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-muted">Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describí tu producto..."
            rows={3}
            className="mt-1 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none resize-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-medium text-muted">Categoría *</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {MARKET_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, category: c })}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  form.category === c
                    ? "border-neon bg-neon/15 text-neon"
                    : "border-edge bg-card text-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Price + Stock + Condition */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-medium text-muted">Precio *</label>
            <input
              type="number"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="$"
              className="mt-1 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Stock</label>
            <input
              type="number"
              inputMode="numeric"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="mt-1 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink focus:border-neon focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Condición</label>
            <div className="mt-1 flex rounded-lg border border-edge overflow-hidden">
              <button
                onClick={() => setForm({ ...form, condition: "new" })}
                className={`flex-1 py-2 text-xs font-medium ${
                  form.condition === "new" ? "bg-neon/15 text-neon" : "text-muted"
                }`}
              >
                Nuevo
              </button>
              <button
                onClick={() => setForm({ ...form, condition: "used" })}
                className={`flex-1 py-2 text-xs font-medium ${
                  form.condition === "used" ? "bg-neon/15 text-neon" : "text-muted"
                }`}
              >
                Usado
              </button>
            </div>
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="text-xs font-medium text-muted">Ubicación</label>
          <div className="relative">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ciudad, barrio..."
              className="mt-1 w-full rounded-lg border border-edge bg-bg px-3 py-2 pl-8 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        </div>

        {/* Publish */}
        <button
          onClick={publish}
          disabled={saving || !form.name.trim() || !form.price || !form.category}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 text-sm font-semibold text-bg shadow-neon disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Publicar
        </button>
      </div>
    </main>
  );
}
