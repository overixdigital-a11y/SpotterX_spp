"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { timeAgo } from "@/lib/format";

interface Conversation {
  otherId: string;
  otherName: string | null;
  otherUsername: string;
  otherAvatar: string | null;
  lastMessage: string | null;
  lastTime: string;
  unread: number;
}

export default function ChatInboxPage() {
  const { userId } = useAuthState();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, content, attachment, created_at, read")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!active) return;

      if (!msgs || msgs.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const threadMap = new Map<string, { lastMsg: typeof msgs[0]; unread: number }>();
      for (const m of msgs) {
        const otherId = m.sender_id === userId ? m.recipient_id : m.sender_id;
        if (!threadMap.has(otherId)) {
          threadMap.set(otherId, { lastMsg: m, unread: 0 });
        }
        const t = threadMap.get(otherId)!;
        if (m.recipient_id === userId && !m.read) {
          t.unread++;
        }
      }

      const otherIds = Array.from(threadMap.keys());
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", otherIds);

      const profMap = new Map<string, { full_name: string | null; username: string; avatar_url: string | null }>();
      (profs ?? []).forEach((p) => profMap.set(p.id, p));

      const convos: Conversation[] = [];
      for (const [otherId, { lastMsg, unread }] of threadMap) {
        const prof = profMap.get(otherId);
        if (!prof) continue;
        const content = lastMsg.attachment
          ? "📸 Adjunto"
          : lastMsg.content || "";
        convos.push({
          otherId,
          otherName: prof.full_name,
          otherUsername: prof.username,
          otherAvatar: prof.avatar_url,
          lastMessage: content,
          lastTime: lastMsg.created_at,
          unread,
        });
      }

      convos.sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
      if (active) {
        setConversations(convos);
        setLoading(false);
      }
    };

    load();
    const channel = supabase
      .channel("chat-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  return (
    <div className="w-full">
      <h1 className="px-4 pt-4 text-xl font-bold text-ink">Mensajes</h1>
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="mb-4 rounded-full bg-neon/10 p-4">
            <MessageSquare className="h-8 w-8 text-neon" />
          </div>
          <p className="text-sm text-muted">Todavía no tenés mensajes.</p>
          <p className="text-xs text-muted mt-1">Contactá a alguien desde su perfil.</p>
        </div>
      ) : (
        <div className="mt-2">
          {conversations.map((c) => (
            <Link
              key={c.otherId}
              href={`/chat/${c.otherId}`}
              className="flex items-center gap-3 border-b border-edge px-4 py-3.5 transition hover:bg-elevated/40"
            >
              <Avatar src={c.otherAvatar} name={c.otherName} username={c.otherUsername} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-semibold text-ink">{c.otherName || c.otherUsername}</p>
                  <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.lastTime)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">{c.lastMessage}</p>
              </div>
              {c.unread > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-neon px-1.5 text-[10px] font-bold text-bg">
                  {c.unread > 9 ? "9+" : c.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
