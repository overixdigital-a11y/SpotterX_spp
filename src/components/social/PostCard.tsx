"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Trash2,
  Pencil,
  Flag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { BottomSheet } from "@/components/core/BottomSheet";
import { CommentsList } from "./CommentsList";
import { useToast } from "@/components/core/ToastProvider";
import { timeAgo, parseMentions } from "@/lib/format";

export interface PostData {
  id: string;
  author_id: string;
  author_name: string;
  username: string;
  avatar_url: string | null;
  caption: string;
  media_url: string | null;
  media_type: "video" | "image" | null;
  category: string | null;
  created_at: string;
  pulses: number;
  pulsed: boolean;
  comments: number;
  saves: number;
  saved: boolean;
}

const reportReasons = [
  "Spam o publicidad",
  "Contenido inapropiado",
  "Acoso o bullying",
  "Información falsa",
  "Otro",
];

export function PostCard({
  post,
  onDeleted,
}: {
  post: PostData;
  onDeleted?: (id: string) => void;
}) {
  const { userId } = useAuthState();
  const toast = useToast();
  const [pulsed, setPulsed] = useState(post.pulsed);
  const [pulses, setPulses] = useState(post.pulses);
  const [saved, setSaved] = useState(post.saved);
  const [saves, setSaves] = useState(post.saves);
  const [comments, setComments] = useState(post.comments);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [caption, setCaption] = useState(post.caption);

  const own = userId !== null && userId === post.author_id;
  const isVideo = post.media_type === "video";

  const onPulse = async () => {
    if (!userId) return;
    const supabase = createClient();
    const prev = { pulsed, pulses };
    const nextPulsed = !pulsed;
    setPulsed(nextPulsed);
    setPulses((n) => n + (nextPulsed ? 1 : -1));
    const { error } = nextPulsed
      ? await supabase.from("post_pulses").insert({ post_id: post.id, user_id: userId })
      : await supabase
          .from("post_pulses")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", userId);
    if (error) {
      setPulsed(prev.pulsed);
      setPulses(prev.pulses);
      toast("No se pudo actualizar el pulse", "error");
    }
  };

  const onToggleSave = async () => {
    if (!userId) return;
    const supabase = createClient();
    const prev = { saved, saves };
    const nextSaved = !saved;
    setSaved(nextSaved);
    setSaves((n) => n + (nextSaved ? 1 : -1));
    const { error } = nextSaved
      ? await supabase.from("post_saves").insert({ post_id: post.id, user_id: userId })
      : await supabase
          .from("post_saves")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", userId);
    if (error) {
      setSaved(prev.saved);
      setSaves(prev.saves);
      toast("No se pudo guardar", "error");
    }
  };

  const onShare = async () => {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "SpotterX", text: post.caption || "", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast("Link copiado");
      }
    } catch {
      // usuario canceló el share nativo
    }
  };

  const onEdit = async () => {
    const next = window.prompt("Editá el texto de tu publicación", post.caption);
    if (next === null) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("posts")
      .update({ caption: next.trim() || null })
      .eq("id", post.id)
      .eq("user_id", userId);
    if (error) toast("No se pudo editar", "error");
    else {
      setCaption(next.trim());
      toast("Publicación editada");
    }
  };

  const onDelete = async () => {
    if (!window.confirm("¿Eliminar esta publicación?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) toast("No se pudo eliminar", "error");
    else {
      onDeleted?.(post.id);
      toast("Publicación eliminada");
    }
  };

  const onReport = async (reason: string) => {
    if (!userId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("post_reports")
      .insert({ post_id: post.id, user_id: userId, reason });
    if (error) toast("No se pudo enviar el reporte", "error");
    else {
      toast("Gracias, lo revisamos");
      setShowReport(false);
    }
  };

  const profileHref = `/perfil/${post.username}`;

  const renderCaption = () => {
    return parseMentions(caption).map((part, i) =>
      part.handle ? (
        <Link
          key={i}
          href={`/perfil/${part.handle}`}
          className="font-semibold text-neon"
        >
          {part.raw}
        </Link>
      ) : (
        <span key={i}>{part.raw}</span>
      )
    );
  };

  return (
    <article className="relative mb-3 overflow-hidden rounded-2xl border border-edge bg-card">
      {/* Categoría */}
      {post.category && (
        <Link
          href={`/discover?cat=${encodeURIComponent(post.category)}`}
          className="absolute left-3 top-3 z-10 rounded-full bg-bg/70 px-2.5 py-0.5 text-[10px] font-semibold text-neon backdrop-blur"
        >
          {post.category}
        </Link>
      )}

      {/* Media */}
      {post.media_url ? (
        isVideo ? (
          <video
            src={post.media_url}
            controls
            muted
            loop
            playsInline
            className="aspect-square w-full bg-bg object-cover md:aspect-[4/5]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.media_url}
            alt={post.caption || ""}
            className="aspect-square w-full bg-bg object-cover md:aspect-[4/5]"
          />
        )
      ) : (
        <Link href={`/posts/${post.id}`} className="block aspect-square w-full bg-gradient-to-br from-elevated to-bg md:aspect-[4/5]">
          <div className="flex h-full items-center justify-center">
            <Zap className="h-12 w-12 text-neon/70" />
          </div>
        </Link>
      )}

      {/* Cabecera */}
      <div className="flex items-center gap-2 p-3">
        <Link href={profileHref} className="shrink-0">
          <Avatar src={post.avatar_url} name={post.author_name} username={post.username} size="sm" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={profileHref} className="text-sm font-semibold text-ink hover:text-neon">
            {post.author_name}
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Link href={profileHref}>@{post.username}</Link>
            <span>·</span>
            <span>{timeAgo(post.created_at)}</span>
          </div>
        </div>
        <button
          onClick={() => setShowMenu(true)}
          className="rounded-lg p-1.5 text-muted transition hover:text-ink"
          aria-label="Opciones"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {caption && (
        <Link href={`/posts/${post.id}`} className="block px-3 pb-3 text-sm text-ink">
          {renderCaption()}
        </Link>
      )}

      {/* Acciones flotantes */}
      <div className="absolute bottom-3 right-2.5 flex flex-col items-center gap-3">
        <button
          onClick={onPulse}
          className={`flex flex-col items-center gap-0.5 transition active:scale-90 ${
            pulsed ? "text-neon" : "text-muted hover:text-neon"
          }`}
          aria-label="Pulse"
        >
          <Zap className={`h-7 w-7 ${pulsed ? "fill-neon" : ""}`} strokeWidth={2.2} />
          <span className="text-[11px] font-semibold">{pulses}</span>
        </button>
        <button
          onClick={() => setShowComments(true)}
          className="flex flex-col items-center gap-0.5 text-muted transition hover:text-neon active:scale-90"
          aria-label="Comentarios"
        >
          <MessageCircle className="h-7 w-7" strokeWidth={2.2} />
          <span className="text-[11px]">{comments}</span>
        </button>
        <button
          onClick={onShare}
          className="flex flex-col items-center gap-0.5 text-muted transition hover:text-neon active:scale-90"
          aria-label="Compartir"
        >
          <Share2 className="h-6 w-6" strokeWidth={2.2} />
        </button>
        <button
          onClick={onToggleSave}
          className={`flex flex-col items-center gap-0.5 transition active:scale-90 ${
            saved ? "text-ember" : "text-muted hover:text-ember"
          }`}
          aria-label="Guardar"
        >
          <Bookmark className={`h-6 w-6 ${saved ? "fill-ember" : ""}`} strokeWidth={2.2} />
          <span className="text-[11px] font-semibold">{saves}</span>
        </button>
      </div>

      {/* Menú de acciones */}
      <BottomSheet open={showMenu} onClose={() => setShowMenu(false)} title="Opciones">
        <div className="space-y-2">
          {own && (
            <>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-edge bg-card px-4 py-3 text-sm text-ink"
              >
                <Pencil className="h-4 w-4 text-neon" /> Editar publicación
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember"
              >
                <Trash2 className="h-4 w-4" /> Eliminar publicación
              </button>
            </>
          )}
          <button
            onClick={() => {
              setShowMenu(false);
              setShowReport(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-edge bg-card px-4 py-3 text-sm text-ink"
          >
            <Flag className="h-4 w-4 text-ember" /> Reportar
          </button>
          <button
            onClick={onShare}
            className="flex w-full items-center gap-3 rounded-xl border border-edge bg-card px-4 py-3 text-sm text-ink"
          >
            <Share2 className="h-4 w-4 text-neon" /> Compartir
          </button>
        </div>
      </BottomSheet>

      {/* Reporte */}
      <BottomSheet open={showReport} onClose={() => setShowReport(false)} title="Reportar publicación">
        <p className="text-xs text-muted">¿Qué problema tiene esta publicación?</p>
        <div className="mt-3 space-y-2">
          {reportReasons.map((r) => (
            <button
              key={r}
              onClick={() => onReport(r)}
              className="w-full rounded-xl border border-edge bg-card px-4 py-3 text-left text-sm text-ink"
            >
              {r}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Comentarios */}
      <BottomSheet open={showComments} onClose={() => setShowComments(false)} title="Comentarios">
        <CommentsList postId={post.id} viewerId={userId} onCountChange={setComments} />
      </BottomSheet>
    </article>
  );
}