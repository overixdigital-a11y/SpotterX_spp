"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Package,
  Pencil,
  Trash2,
  Pause,
  Play,
  Sparkles,
  CheckCircle2,
  X,
  MapPin,
  ShoppingBag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useToast } from "@/components/core/ToastProvider";
import { MARKET_CATEGORIES, formatPrice, type MarketProduct } from "@/lib/market";
import { getMarketConfig, activePaymentAccount, type MarketConfig } from "@/lib/market-config";

interface PublishQuote {
  free_limit: number;
  free_left: number;
  price: number;
  balance: number;
  in_shop: number;
  will_pay: boolean;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Publicado", cls: "bg-neon/15 text-neon" },
  paused: { label: "En pausa", cls: "bg-bg text-muted" },
  sold: { label: "Vendido", cls: "bg-ember/15 text-ember" },
  pending: { label: "Pendiente de pago", cls: "bg-ember/15 text-ember" },
};

export default function GymArticulosPage() {
  const { userId } = useAuthState();
  const router = useRouter();
  const toast = useToast();
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "" as (typeof MARKET_CATEGORIES)[number] | "",
    condition: "new" as "new" | "used",
    stock: "1",
    location: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [quote, setQuote] = useState<PublishQuote | null>(null);
  const [config, setConfig] = useState<MarketConfig | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("market_products")
      .select("*")
      .eq("seller_id", userId)
      .order("created_at", { ascending: false });
    if (data) setProducts(data as MarketProduct[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("gym-articulos-live")
      .on(
        "postgres_changes" as const,
        { event: "*", schema: "public", table: "market_products", filter: `seller_id=eq.${userId}` },
        () => {
          void load();
        }
      )
      .subscribe();
    supabase.rpc("get_publish_quote").then(({ data }) => {
      if (data) setQuote(data as PublishQuote);
    });
    getMarketConfig().then((cfg) => setConfig(cfg));
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => {
      clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const account = config ? activePaymentAccount(config) : null;

  const resetForm = () => {
    setEditingId(null);
    setExistingImages([]);
    setForm({ name: "", description: "", price: "", category: "", condition: "new", stock: "1", location: "" });
    setFiles([]);
    setPreviews((prev) => {
      prev.forEach((p) => {
        if (p.startsWith("blob:")) URL.revokeObjectURL(p);
      });
      return [];
    });
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    if (files.length + newFiles.length > 5) return;
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setFiles((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (idx: number) => {
    const p = previews[idx];
    if (p.startsWith("blob:")) URL.revokeObjectURL(p);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

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

  const editProduct = (p: MarketProduct) => {
    setEditingId(p.id);
    setExistingImages(p.images ?? []);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      category: p.category as (typeof MARKET_CATEGORIES)[number],
      condition: p.condition,
      stock: String(p.stock),
      location: p.location ?? "",
    });
    setFiles([]);
    setPreviews([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    if (!userId || !form.name.trim() || !form.price || !form.category) return;
    setSaving(true);
    const supabase = createClient();
    const base = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      category: form.category,
      condition: form.condition,
      stock: Number(form.stock) || 1,
      location: form.location.trim() || null,
    };

    if (editingId) {
      const newUrls = await uploadImages();
      const images = newUrls.length > 0 ? newUrls : existingImages;
      const { error } = await supabase
        .from("market_products")
        .update({ ...base, images })
        .eq("id", editingId)
        .eq("seller_id", userId);
      setSaving(false);
      if (error) {
        toast(error.message, "error");
        return;
      }
      toast("Artículo actualizado");
      resetForm();
      void load();
      return;
    }

    const rpcBase = {
      p_name: base.name,
      p_description: base.description,
      p_price: base.price,
      p_category: base.category,
      p_condition: base.condition,
      p_stock: base.stock,
      p_location: base.location,
      p_images: await uploadImages(),
    };

    if (quote?.will_pay) {
      setSaving(false);
      setShowPayModal(true);
      return;
    }

    const { error } = await supabase.rpc("market_publish", rpcBase);
    setSaving(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    toast("Artículo publicado");
    resetForm();
    void load();
  };

  const publishPending = async () => {
    if (!userId || !form.name.trim() || !form.price || !form.category) return;
    setSaving(true);
    const supabase = createClient();
    const newUrls = await uploadImages();
    const { data: pedido, error } = await supabase.rpc("market_publish_pending", {
      p_name: form.name.trim(),
      p_description: form.description.trim() || null,
      p_price: Number(form.price),
      p_category: form.category,
      p_condition: form.condition,
      p_stock: Number(form.stock) || 1,
      p_location: form.location.trim() || null,
      p_images: newUrls,
    });
    setSaving(false);
    if (error || !pedido) {
      toast(error?.message ?? "No se pudo dejar la publicación pendiente", "error");
      return;
    }
    setShowPayModal(false);
    toast(`Artículo pendiente — Pedido ${pedido}. Se publica cuando el admin confirme tu depósito.`);
    resetForm();
    void load();
  };

  const toggleStatus = async (p: MarketProduct) => {
    if (p.status !== "active" && p.status !== "paused") return;
    const newStatus = p.status === "active" ? "paused" : "active";
    const supabase = createClient();
    const { error } = await supabase
      .from("market_products")
      .update({ status: newStatus })
      .eq("id", p.id)
      .eq("seller_id", userId);
    if (error) return;
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: newStatus as MarketProduct["status"] } : x)));
  };

  const remove = async (p: MarketProduct) => {
    if (!window.confirm(`¿Borrar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("market_products").delete().eq("id", p.id).eq("seller_id", userId);
    if (error) {
      toast(error.message, "error");
      return;
    }
    toast("Artículo borrado");
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-md p-4 pt-10 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl">
      <div className="px-4 py-6">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-neon" />
          <h1 className="text-lg font-bold text-ink">Artículos del gym</h1>
        </div>
        <p className="mt-1 text-xs text-muted">
          Publicá los artículos que vendés (ropa, suplementos, accesorios...). Aparecen en{" "}
          <b className="text-ink">Mi gimnasio</b> para tus alumnos y en la tienda SpotterShop.
        </p>
      </div>

      <div className="space-y-4 p-4 pt-0">
        {quote &&
          (quote.will_pay ? (
            <div className="rounded-xl border border-ember/30 bg-ember/10 p-3 text-xs text-ink">
              <p className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 shrink-0 text-ember" />
                <span>
                  Artículo pago: <b>{formatPrice(quote.price)}</b>. Se te acabó el cupo gratis (
                  {config?.freeCount ?? 3} publicaciones).
                </span>
              </p>
              <p className="mt-1.5 text-muted">
                Al tocar <b>Publicar</b> vas a ver la cuenta del administrador para transferir. El
                artículo queda <b>pendiente</b> hasta que el admin confirme el pago.
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

        <div className="rounded-2xl border border-edge bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              {editingId ? "Editar artículo" : "Publicar artículo"}
            </p>
            <div className="flex items-center gap-2">
              {editingId && (
                <button
                  onClick={resetForm}
                  className="text-[10px] font-semibold text-muted transition hover:text-ember"
                >
                  Cancelar edición
                </button>
              )}
              <button
                onClick={() => router.back()}
                className="rounded-lg p-1 text-muted transition hover:text-ink"
                aria-label="Volver"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {editingId && existingImages.length > 0 && (
            <div className="mt-2">
              <label className="text-xs font-medium text-muted">Fotos actuales</label>
              <div className="mt-1.5 flex gap-2 overflow-x-auto no-scrollbar">
                {existingImages.map((src, i) => (
                  <div key={i} className="relative h-16 w-16 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full rounded-lg object-cover" />
                    <button
                      onClick={() => setExistingImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -right-1 -top-1 rounded-full bg-ember p-0.5 text-bg text-[10px]"
                      aria-label="Quitar foto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3">
            <label className="text-xs font-medium text-muted">Fotos nuevas (máx. 5)</label>
            <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
              {previews.map((src, i) => (
                <div key={i} className="relative h-20 w-20 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full rounded-lg object-cover" />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -right-1 -top-1 rounded-full bg-ember p-0.5 text-bg text-[10px]"
                    aria-label="Quitar foto"
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

          <div className="mt-3">
            <label className="text-xs font-medium text-muted">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Protector de muñecas premium"
              className="mt-1 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
          </div>

          <div className="mt-3">
            <label className="text-xs font-medium text-muted">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describí el artículo..."
              rows={3}
              className="mt-1 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none resize-none"
            />
          </div>

          <div className="mt-3">
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

          <div className="mt-3 grid grid-cols-3 gap-2">
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
                  type="button"
                  onClick={() => setForm({ ...form, condition: "new" })}
                  className={`flex-1 py-2 text-xs font-medium ${
                    form.condition === "new" ? "bg-neon/15 text-neon" : "text-muted"
                  }`}
                >
                  Nuevo
                </button>
                <button
                  type="button"
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

          <div className="mt-3">
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

          <button
            onClick={() => void save()}
            disabled={saving || !form.name.trim() || !form.price || !form.category}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-neon py-3 text-sm font-semibold text-bg shadow-neon disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editingId ? "Guardar cambios" : "Publicar artículo"}
          </button>
        </div>

        <div className="rounded-2xl border border-edge bg-card p-4">
          <p className="text-sm font-semibold text-ink">Publicados</p>
          {products.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-edge bg-bg px-3 py-4 text-center text-xs text-muted">
              Todavía no publicaste ningún artículo.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {products.map((p) => {
                const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.active;
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-edge bg-elevated p-2.5">
                    {p.images[0] ? (
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-bg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-bg text-muted">
                        <ShoppingBag className="h-5 w-5 opacity-40" />
                      </div>
                    )}
                    <Link
                      href={`/market/${p.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${st.cls}`}>
                          {st.label}
                        </span>
                        <span className="text-xs font-bold text-neon">{formatPrice(p.price)}</span>
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
                      {(p.status === "active" || p.status === "paused") && (
                        <button
                          onClick={() => void toggleStatus(p)}
                          className="rounded-lg border border-edge p-1.5 text-muted transition hover:text-neon"
                          title={p.status === "active" ? "Pausar" : "Activar"}
                        >
                          {p.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => editProduct(p)}
                        className="rounded-lg border border-edge p-1.5 text-muted transition hover:text-neon"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void remove(p)}
                        className="rounded-lg border border-edge p-1.5 text-muted transition hover:text-ember"
                        title="Borrar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-ember/30 bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-ink">Artículo pago</h2>
                <p className="mt-0.5 text-[11px] text-muted">
                  Transferí <b className="text-ink">{formatPrice(quote?.price ?? 0)}</b> a esta
                  cuenta y tu artículo queda <b className="text-ink">pendiente</b> hasta que el admin
                  confirme el pago.
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
                onClick={() => void publishPending()}
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