"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin, Sparkles, Send, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useToast } from "@/components/core/ToastProvider";
import { MARKET_CATEGORIES, type MarketCategory, formatPrice } from "@/lib/market";
import { getMarketConfig, activePaymentAccount, type MarketConfig } from "@/lib/market-config";

interface PublishQuote {
  free_limit: number;
  free_left: number;
  price: number;
  balance: number;
  in_shop: number;
  will_pay: boolean;
}

export default function MarketCrearPage() {
  const { userId, profile } = useAuthState();
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<PublishQuote | null>(null);
  const [config, setConfig] = useState<MarketConfig | null>(null);
  const [pedido, setPedido] = useState<string | null>(null);
  const [informing, setInforming] = useState(false);
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

  const reportDeposit = async () => {
    if (!quote) return;
    setInforming(true);
    const supabase = createClient();
    const { data: newPedido, error } = await supabase.rpc("report_deposit", {
      p_amount: quote.price,
      p_note: null,
    });
    setInforming(false);
    if (error || !newPedido) {
      toast(error?.message ?? "No se pudo registrar el depósito", "error");
      return;
    }
    setPedido(newPedido as string);

    const account = activePaymentAccount(config);
    const who = profile ? `${profile.full_name ?? ""} (${profile.email ?? "@" + (profile.username ?? "")})`.trim() : "publicador";
    const txt = `Hola! Registré un depósito para publicar en SpotterShop.\n\nPedido: ${newPedido}\nMonto: $${quote.price}\nPublicador: ${who}`.replace(/\n/g, "%0A").replace(/ /g, "%20");

    const whatsapp = config?.contact.whatsapp ?? "";
    if (whatsapp) {
      window.open(`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}?text=${txt}`, "_blank");
    }
    void account;
    toast(`Depósito registrado (Pedido ${newPedido}). Enviá el comprobante por WhatsApp al admin.`);
  };

  const account = config ? activePaymentAccount(config) : null;

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

    const { error } = await supabase.rpc("market_publish", {
      p_name: form.name.trim(),
      p_description: form.description.trim() || null,
      p_price: Number(form.price),
      p_category: form.category,
      p_condition: form.condition,
      p_stock: Number(form.stock) || 1,
      p_location: form.location.trim() || null,
      p_images: imageUrls,
    });

    setSaving(false);
    if (error) {
      toast(
        error.message.includes("Saldo insuficiente")
          ? "Saldo insuficiente para publicar. Cargá saldo en tu billetera."
          : error.message,
        "error"
      );
      return;
    }
    router.push("/market");
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
        {/* Quota banner */}
        {quote &&
          (quote.will_pay ? (
            quote.balance >= quote.price ? (
              <div className="flex items-center gap-2 rounded-xl border border-ember/30 bg-ember/10 p-3 text-xs font-medium text-ink">
                <Sparkles className="h-4 w-4 shrink-0 text-ember" />
                <span>
                  Esta publicación cuesta <b>{quote.price}</b> (ya usaste tu cupo gratis) y se descuenta de tu
                  billetera al publicar.
                </span>
              </div>
            ) : account ? (
              <div className="rounded-xl border border-ember/30 bg-ember/10 p-3 text-xs text-ink">
                <p className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4 shrink-0 text-ember" />
                  <span>
                    Publicación paga: <b>${quote.price}</b>. Se te acabó el cupo gratis (
                    {config?.freeCount ?? 3} publicaciones) y tu saldo es <b>{formatPrice(quote.balance)}</b>.
                  </span>
                </p>
                <div className="mt-2.5 space-y-1 rounded-lg border border-ember/20 bg-bg/60 p-2.5">
                  <p className="font-semibold text-ink">
                    Transferí a: {account.bank} — {account.account_type}
                  </p>
                  <p className="text-ink">{account.number}</p>
                  {account.holder && <p className="text-ink">Titular: {account.holder}</p>}
                  {account.note && <p className="text-muted">{account.note}</p>}
                  {config?.contact.email && (
                    <p className="text-muted">Contacto: {config.contact.email}</p>
                  )}
                </div>
                {pedido ? (
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-neon/30 bg-neon/10 p-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-neon" />
                    <span>
                      Depósito registrado. Tu <b>pedido es {pedido}</b> — guardalo y mandá el
                      comprobante por WhatsApp para que te acrediten el saldo.
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={reportDeposit}
                    disabled={informing}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ember py-2 text-xs font-bold text-bg disabled:opacity-50"
                  >
                    {informing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Hice el depósito — avisar
                  </button>
                )}
                <Link href="/market/billetera" className="mt-1.5 inline-block font-semibold text-ember">
                  Ver mi billetera →
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-ember/30 bg-ember/10 p-3 text-xs text-ink">
                <p className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4 shrink-0 text-ember" />
                  <span>
                    Esta publicación cuesta <b>{quote.price}</b> y tu saldo es <b>{quote.balance}</b>.
                  </span>
                </p>
                <Link href="/market/billetera" className="mt-1.5 inline-block font-semibold text-ember">
                  Cargar saldo en mi billetera →
                </Link>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-neon/30 bg-neon/10 p-3 text-xs font-medium text-ink">
              <Sparkles className="h-4 w-4 shrink-0 text-neon" />
              <span>Publicación gratis: te quedan <b>{quote.free_left}</b> de tu cupo ({quote.in_shop}/{quote.free_limit}).</span>
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
    </main>
  );
}
