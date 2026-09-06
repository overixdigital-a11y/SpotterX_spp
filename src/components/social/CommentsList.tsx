"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Send, Trash2, CornerDownRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/core/Avatar";
import { timeAgo } from "@/lib/format";

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface CommentsListProps {
  postId: string;
  viewerId: string | null;
  onCountChange?: (count: number) => void;
}

export function CommentsList({ postId, viewerId, onCountChange }: CommentsListProps) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("post_comments")
        .select("id, content, created_at, user_id, parent_id, author:user_id(username, full_name, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (!active) return;
      const rows = (data ?? []) as unknown as CommentRow[];
      setComments(rows);
      onCountChange?.(rows.length);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const send = async (content: string, parentId: string | null) => {
    if (!viewerId || !content.trim()) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: viewerId,
      content: content.trim(),
      parent_id: parentId,
    });
    setSending(false);
    if (error) return;
    setDraft("");
    setReplyTo(null);
    const reload = async () => {
      const { data } = await supabase
        .from("post_comments")
        .select("id, content, created_at, user_id, parent_id, author:user_id(username, full_name, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (data) {
        const rows = data as unknown as CommentRow[];
        setComments(rows);
        onCountChange?.(rows.length);
      }
    };
    reload();
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("post_comments").delete().eq("id", id);
    if (error) return;
    setComments((c) => c.filter((x) => x.id !== id));
    onCountChange?.(comments.length - 1);
  };

  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-neon" />
      </div>
    );
  }

  return (
    <div>
      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Sé el primero en comentar 💬
        </p>
      ) : (
        <div className="space-y-4">
          {roots.map((c) => {
            const own = viewerId === c.user_id;
            const replies = repliesOf(c.id);
            return (
              <div key={c.id}>
                <div className="flex items-start gap-2.5">
                  <Link href={`/perfil/${c.author?.username ?? ""}`} className="shrink-0">
                    <Avatar
                      src={c.author?.avatar_url}
                      name={c.author?.full_name}
                      username={c.author?.username}
                      size="sm"
                      ring={false}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="rounded-xl bg-card px-3 py-2">
                      <p className="text-xs font-semibold text-neon">
                        {c.author?.full_name || c.author?.username || "Usuario"}
                      </p>
                      <p className="text-sm text-ink">{c.content}</p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 px-1 text-[11px] text-muted">
                      <span>{timeAgo(c.created_at)}</span>
                      {viewerId && (
                        <button
                          onClick={() => setReplyTo(replyTo?.id === c.id ? null : c)}
                          className="font-medium hover:text-ink"
                        >
                          Responder
                        </button>
                      )}
                      {own && (
                        <button
                          onClick={() => remove(c.id)}
                          className="flex items-center gap-0.5 font-medium text-ember hover:text-ember/70"
                        >
                          <Trash2 className="h-3 w-3" /> Borrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {replies.length > 0 && (
                  <div className="mt-3 space-y-3 pl-8">
                    {replies.map((r) => (
                      <div key={r.id} className="flex items-start gap-2.5">
                        <Link href={`/perfil/${r.author?.username ?? ""}`} className="shrink-0">
                          <Avatar
                            src={r.author?.avatar_url}
                            name={r.author?.full_name}
                            username={r.author?.username}
                            size="sm"
                            ring={false}
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="rounded-xl bg-elevated px-3 py-2">
                            <p className="text-xs font-semibold text-neon">
                              {r.author?.full_name || r.author?.username || "Usuario"}
                            </p>
                            <p className="text-sm text-ink">{r.content}</p>
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 px-1 text-[11px] text-muted">
                            <span>{timeAgo(r.created_at)}</span>
                            {viewerId === r.user_id && (
                              <button
                                onClick={() => remove(r.id)}
                                className="flex items-center gap-0.5 font-medium text-ember hover:text-ember/70"
                              >
                                <Trash2 className="h-3 w-3" /> Borrar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewerId && (
        <div className="mt-5">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-elevated px-3 py-2 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <CornerDownRight className="h-3 w-3" />
                Respondiendo a {replyTo.author?.full_name || replyTo.author?.username}
              </span>
              <button onClick={() => setReplyTo(null)} className="font-semibold text-ink">
                Cancelar
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(draft, replyTo?.id ?? null)}
              placeholder={replyTo ? "Escribí tu respuesta…" : "Agregá un comentario…"}
              className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
            />
            <button
              onClick={() => send(draft, replyTo?.id ?? null)}
              disabled={sending || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon text-bg shadow-neon transition active:scale-95 disabled:opacity-50"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}