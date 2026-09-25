"use client";

import { useEffect, useState } from "react";
import { Megaphone, Tag, Loader2, Trash2, Check, Pencil, X, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { useToast } from "@/components/core/ToastProvider";
import { formatPrice } from "@/lib/market";

interface Gym {
  id: string;
  name: string | null;
}

interface Announcement {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  image_url: string | null;
  product_id: string | null;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

const KINDS = [
  { value: "comunicado", label: "Comunicado", tone: "neon" },
  { value: "promo", label: "Promo", tone: "ember" },
];

export default function GymPromosPage() {
  const { userId } = useAuthState();
  const toast = useToast();
  const [gym, setGym] = useState<Gym | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ kind: "comunicado", title: "", body: "", product_id: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) {
        if (active) setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data: g } = await supabase
        .from("gyms")
        .select("id, name")
        .eq("owner_id", userId)
        .maybeSingle();
      if (!active || !g) {
        if (active) setLoading(false);
        return;
      }
      setGym(g as Gym);
      const [{ data: a }, { data: p }] = await Promise.all([
        supabase
          .from("gym_announcements")
          .select("*")
          .eq("gym_id", g.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("market_products")
          .select("id, name, price")
          .eq("seller_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);
      if (active) setAnnouncements((a ?? []) as Announcement[]);
      if (active) setProducts((p ?? []) as Product[]);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const resetForm = () => {
    setForm({ kind: "comunicado", title: "", body: "", product_id: "" });
    setEditingId(null);
    setImageFile(null);
    setPreviewUrl(null);
    setImageUrl(null);
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({ kind: a.kind, title: a.title, body: a.body ?? "", product_id: a.product_id ?? "" });
    setImageUrl(a.image_url);
    setPreviewUrl(a.image_url);
  };

  const onPickImage = (file: File | null) => {
    setImageFile(file);
    if (previewUrl && !imageUrl) URL.revokeObjectURL(previewUrl);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      if (imageUrl) setImageUrl(null);
    } else {
      setPreviewUrl(imageUrl ?? null);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !userId) return null;
    const supabase = createClient();
    const ext = imageFile.name.split(".").pop() ?? "jpg";
    const path = `${userId}/promos/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, imageFile);
    if (error) {
      toast("No se pudo subir la imagen.", "error");
      return null;
    }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return data?.publicUrl ?? null;
  };

  const save = async () => {
    if (!gym || !userId || !form.title.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const finalImage = imageFile ? await uploadImage() : imageUrl;
    const payload = {
      gym_id: gym.id,
      creator_id: userId,
      kind: form.kind,
      title: form.title.trim(),
      body: form.body.trim() || null,
      image_url: finalImage ?? null,
      product_id: form.product_id || null,
    };
    if (editingId) {
      const { error } = await supabase.from("gym_announcements").update(payload).eq("id", editingId);
      if (!error) {
        toast("Publicación actualizada.");
        resetForm();
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === editingId ? { ...a, ...payload, created_at: a.created_at } : a))
        );
      } else {
        toast(error.message, "error");
      }
    } else {
      const { data, error } = await supabase.from("gym_announcements").insert(payload).select().single();
      if (!error && data) {
        toast("Publicación creada. Tus alumnos ya la pueden ver.");
        resetForm();
        setAnnouncements((prev) => [data as Announcement, ...prev]);
      } else {
        toast(error?.message ?? "No se pudo guardar.", "error");
      }
    }
    setSaving(false);
  };

  const remove = async (a: Announcement) => {
    if (!window.confirm(`Eliminar "${a.title}"?`)) return;
    const { error } = await createClient().from("gym_announcements").delete().eq("id", a.id);
    if (error) {
      toast(error.message, "error");
      return;
    }
    setAnnouncements((prev) => prev.filter((x) => x.id !== a.id));
    if (editingId === a.id) resetForm();
    toast("Publicación eliminada.");
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl">
      <div className="border-b border-edge/60 pb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
          <Megaphone className="h-6 w-6 text-neon" /> Comunicados y Promos
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          Publicá avisos, novedades y promos para tus alumnos. Se muestran en su app dentro de
          &quot;Mi gimnasio&quot;.
        </p>
        <p className="mt-1 text-xs text-muted">
          Los planes con promo (2x1 / 3x2 / 4x3) se muestran solos: no hace falta publicarlos acá.
        </p>
      </div>

      {/* Form */}
      <div className="mt-5 rounded-2xl border border-edge bg-card p-5">
        <h2 className="text-base font-bold text-ink">
          {editingId ? "Editar publicación" : "Nueva publicación"}
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setForm({ ...form, kind: k.value })}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                    form.kind === k.value
                      ? k.tone === "neon"
                        ? "border-neon/50 bg-neon/10 text-neon"
                        : "border-ember/50 bg-ember/10 text-ember"
                      : "border-edge bg-elevated text-muted"
                  }`}
                >
                  {k.value === "promo" ? <Tag className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Título</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej: Promo verano: 2x1 en el plan trimestral"
              className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Texto (opcional)</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={3}
              placeholder="Detalles de la promo o el aviso…"
              className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Imagen (opcional)</label>
            {previewUrl ? (
              <div className="relative w-fit">
                <img
                  src={previewUrl}
                  alt=""
                  className="h-28 w-28 rounded-xl border border-edge object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <button
                  type="button"
                  onClick={() => onPickImage(null)}
                  className="absolute -right-2 -top-2 rounded-full border border-edge bg-card p-1 text-muted hover:text-ember"
                  aria-label="Quitar imagen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neon/40 bg-neon/5 px-3.5 py-2.5 text-xs font-medium text-neon transition hover:bg-neon/10">
                <ImagePlus className="h-4 w-4" /> Subir imagen
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Artículo de SpotterShop (opcional)</label>
            <select
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="w-full rounded-xl border border-edge bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-neon focus:outline-none"
            >
              <option value="">Sin artículo ligado</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · ${formatPrice(p.price)}
                </option>
              ))}
            </select>
            {products.length === 0 && (
              <p className="mt-1 text-[10px] text-muted">
                No tenés publicaciones activas en SpotterShop para ligar.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !form.title.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-neon py-3 font-semibold text-bg shadow-neon transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editingId ? "Guardar cambios" : "Publicar"}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="flex items-center justify-center gap-2 rounded-xl border border-edge bg-elevated px-4 py-3 text-sm font-medium text-muted transition hover:text-ink"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-6 space-y-3">
        <h2 className="text-base font-bold text-ink">Publicados</h2>
        {announcements.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-edge bg-card p-8 text-center text-xs text-muted">
            Todavía no publicaste ningún comunicado ni promo.
          </p>
        ) : (
          announcements.map((a) => {
            const kind = KINDS.find((k) => k.value === a.kind) ?? KINDS[0];
            const product = products.find((p) => p.id === a.product_id);
            return (
              <div key={a.id} className="rounded-2xl border border-edge bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {a.image_url && (
                      <img
                        src={a.image_url}
                        alt=""
                        className="mb-3 h-24 w-full rounded-xl border border-edge object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        kind.tone === "neon" ? "bg-neon/15 text-neon" : "bg-ember/15 text-ember"
                      }`}
                    >
                      {kind.value === "promo" ? <Tag className="h-3 w-3" /> : <Megaphone className="h-3 w-3" />}
                      {kind.label}
                    </span>
                    <p className="mt-1.5 text-sm font-bold text-ink">{a.title}</p>
                    {a.body && <p className="mt-0.5 text-xs text-muted whitespace-pre-line">{a.body}</p>}
                    {product && (
                      <p className="mt-1.5 w-fit rounded-lg border border-neon/30 bg-neon/5 px-2 py-1 text-[10px] font-semibold text-neon">
                        Ligado: {product.name} · ${formatPrice(product.price)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <p className="text-[10px] text-muted">
                      {new Date(a.created_at).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                    <button
                      onClick={() => startEdit(a)}
                      className="rounded-lg border border-edge p-2 text-muted transition hover:border-neon/40 hover:text-neon"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(a)}
                      className="rounded-lg border border-edge p-2 text-muted transition hover:border-ember/40 hover:text-ember"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}