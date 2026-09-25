"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MapPin, Sparkles, CheckCircle2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useToast } from "@/components/core/ToastProvider";
import { MARKET_CATEGORIES, type MarketCategory, formatPrice } from "@/lib/market";
import { getMarketConfig, activePaymentAccount, type MarketConfig } from "@/lib/market-config";
import { useModuleGuard } from "@/lib/gym-modules";

interface PublishQuote {
  free_limit: number;
  free_left: number;
  price: number;
  balance: number;
  in_shop: number;
  will_pay: boolean;
}

export default function MarketCrearPage() {
  const { userId } = useAuthState();
  const router = useRouter();
  const toast = useToast();
  const { busy } = useModuleGuard("spotter_shop");
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<PublishQuote | null>(null);
  const [config, setConfig] = useState<MarketConfig | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
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

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase.rpc("get_publish_quote").then(({ data }) => {
      if (data) setQuote(data as PublishQuote);
    });
    getMarketConfig().then((cfg) => setConfig(cfg));
  }, [userId]);

  const account = config ? activePaymentAccount(config) : null;

  const uploadImages = async (): Promise<string[]> => {
    if (!userId) return [];
    const supabase = createClient();
    const urls: string[] = [];
    for (const f of files) {
      const ext = f.name.split(".").pop() ?? "jpg";
      const path = `${userId}/market/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, f);
      if (!error) {
        const { data } = supabase.storage.from("media").getPublicUrl(path);
        if (data?.publicUrl) urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const finalizePublish = async (mode: "free" | "pending") => {
    if (!userId || !form.name.trim() || !form.price || !form.category) return;
    setSaving(true);
    const supabase = createClient();
    const imageUrls = await uploadImages();
    const base = {
      p_name: form.name.trim(),
      p_description: form.description.trim() || null,
      p_price: Number(form.price),
      p_category: form.category,
      p_condition: form.condition,
      p_stock: Number(form.stock) || 1,
      p_location: form.location.trim() || null,
      p_images: imageUrls,
    };

    if (mode === "free") {
      const { error } = await supabase.rpc("market_publish", base);
      setSaving(false);
      if (error) {
        toast(error.message, "error");
        return;
      }
      router.push("/market");
      return;
    }

    const { data: pedido, error } = await supabase.rpc("market_publish_pending", base);
    setSaving(false);
    if (error || !pedido) {
      toast(error?.message ?? "No se pudo dejar la publicación pendiente", "error");
      return;
    }
    setShowPayModal(false);
    toast(`Publicación pendiente — Pedido ${pedido}. Se publica cuando el admin confirme tu depósito.`);
    router.push("/market/mis-publicaciones");
  };

  const publish = () => {
    if (!userId || !form.name.trim() || !form.price || !form.category) return;
    if (quote?.will_pay) {
      setShowPayModal(true);
      return;
    }
    void finalizePublish("free");
  };

  if (busy) {
    return (
      <main className="mx-auto max-w-md p-4 pt-20 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur">
        <button onClick={() => router.back()} className="text-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-ink">Publicar producto</h1>
      </div>

      <div className="space-y-4 p-4">
        {/* Quota banner */}
        {quote &&
          (quote.will_pay ? (
            <div className="rounded-xl border border-ember/30 bg-ember/10 p-3 text-xs text-ink">
              <p className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 shrink-0 text-ember" />
                <span>
                  Publicación paga: <b>{formatPrice(quote.price)}</b>. Se te acabó el cupo gratis (
                  {config?.freeCount ?? 3} publicaciones).
                </span>
              </p>
              <p className="mt-1.5 text-muted">
                Al tocar <b>Publicar</b> vas a ver la cuenta del administrador para transferir. Tu
                publicación queda <b>pendiente</b> hasta que el admin confirme el pago.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-neon/30 bg-neon/10 p-3 text-xs font-medium text-ink">
              <Sparkles className="h-4 w-4 shrink-0 text-neon" />
              <span>
                Publicación gratis: te quedan <b>{quote.free_left}</b> de tu cupo ({quote.in_shop}/
                {quote.free_limit}).
              </span>
            </div>
          ))}

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

      {/* Publicación paga modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-ember/30 bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-ink">Publicación paga</h2>
                <p className="mt-0.5 text-[11px] text-muted">
                  Transferí <b className="text-ink">{formatPrice(quote?.price ?? 0)}</b> a esta
                  cuenta y tu publicación queda <b className="text-ink">pendiente</b> hasta que el
                  admin confirme el pago.
                </p>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="rounded-lg p-1 text-muted hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {account ? (
              <div className="mt-3 rounded-xl border border-ember/20 bg-bg/60 p-3">
                <p className="text-xs font-bold text-ink">
                  {account.bank} — {account.account_type}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-ink">{account.number}</p>
                {account.holder && <p className="text-[11px] text-ink">Titular: {account.holder}</p>}
                {account.note && <p className="text-[11px] text-muted">{account.note}</p>}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-ember/20 bg-bg/60 p-3 text-[11px] text-ink">
                El administrador todavía no cargó una cuenta de cobro. Contactalo para que te pase
                los datos para transferir.
              </div>
            )}
            {config?.contact.email && (
              <p className="mt-2 text-[11px] text-muted">
                Contacto: {config.contact.email}
                {config.contact.whatsapp ? ` · WhatsApp ${config.contact.whatsapp}` : ""}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowPayModal(false)}
                disabled={saving}
                className="flex-1 rounded-xl border border-edge py-2.5 text-xs font-semibold text-muted hover:text-ink disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void finalizePublish("pending")}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ember py-2.5 text-xs font-bold text-bg disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Confirmé la transferencia y publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}