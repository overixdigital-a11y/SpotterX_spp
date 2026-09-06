"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { timeAgo } from "@/lib/format";

interface OtherUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
}

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const otherId = params.id;
  const { userId } = useAuthState();
  const [other, setOther] = useState<OtherUser | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data: o } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      if (active && o) setOther(o as OtherUser);

      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, content, created_at")
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`)
        .order("created_at", { ascending: true })
        .limit(200);
      if (active && data) setMessages(data as Msg[]);
      if (active) setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`chat-${otherId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${otherId}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [otherId, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!userId || !draft.trim() || sending) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from("messages").insert({
      sender_id: userId,
      recipient_id: otherId,
      content: draft.trim(),
    });
    setSending(false);
    if (error) return;
    setDraft("");
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, created_at")
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) setMessages(data as Msg[]);
  };

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-full max-w-md flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur">
        <Link href="/home" className="text-muted transition hover:text-ink">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Link href={`/perfil/${other?.username}`} className="flex items-center gap-2.5">
          <Avatar
            src={other?.avatar_url}
            name={other?.full_name}
            username={other?.username}
            size="sm"
          />
          <p className="text-sm font-bold text-ink">
            {other?.full_name || other?.username || "Mensaje"}
          </p>
        </Link>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            {other ? `Escribile a ${other.full_name || other.username}!` : "No hay mensajes todavía."}
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                  mine ? "bg-neon text-bg" : "border border-edge bg-card text-ink"
                }`}
              >
                <p className="text-sm">{m.content}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? "text-bg/70" : "text-muted"}`}>
                  {timeAgo(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-edge bg-bg px-4 py-3 pb-20">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Escribí un mensaje…"
          className="w-full rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon text-bg shadow-neon transition active:scale-95 disabled:opacity-50"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </main>
  );
}