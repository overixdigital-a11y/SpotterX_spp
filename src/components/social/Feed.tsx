"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PostCard, type PostData } from "./PostCard";
import { hydratePosts, type PostRow } from "@/lib/posts";
import { EmptyState } from "@/components/core/EmptyState";
import { Skeleton } from "@/components/core/Skeleton";
import { useAuthState } from "@/lib/auth-context";
import { Sparkles, Users, Loader2, Flame } from "lucide-react";
import { computeStreak, logDates } from "@/lib/history";
import { todayLocal } from "@/lib/format";
import PostComposer from "./PostComposer";
import { getBlockedOwners } from "@/lib/gym-modules";

const PAGE = 12;

let blockedFeedOwners: Promise<Set<string>> | null = null;
function blockedOwnersOf() {
  if (!blockedFeedOwners) {
    blockedFeedOwners = getBlockedOwners("feed").then((owners) => new Set(owners));
  }
  return blockedFeedOwners;
}

const categories = [
  "#CrossFit",
  "#Running",
  "#Powerlifting",
  "#Calistenia",
  "#Yoga",
  "#Boxeo",
  "#Nutrición",
  "#Cardio",
];

type Tab = "all" | "following";

export function Feed() {
  const { userId } = useAuthState();
  const [tab, setTab] = useState<Tab>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const [composer, setComposer] = useState<{ caption: string } | null>(null);
  const [composerNonce, setComposerNonce] = useState(0);
  const [loadingStreak, setLoadingStreak] = useState(false);

  const openStreak = async () => {
    if (!userId) return;
    setLoadingStreak(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("trainer_routine_logs")
      .select("log_date")
      .eq("student_id", userId);
    const dates = logDates((data as { log_date: string }[] | null) ?? []);
    const streak = computeStreak(dates, todayLocal());
    setComposer({ caption: `🔥 Mi racha actual: ${streak} ${streak === 1 ? "día" : "días"}` });
    setComposerNonce((n) => n + 1);
    setLoadingStreak(false);
  };

  const fetchPage = async (replace: boolean) => {
    const supabase = createClient();

    let followingIds: string[] = [];
    if (tab === "following" && userId) {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      followingIds = (data ?? []).map((f) => f.following_id as string);
      if (followingIds.length === 0) {
        if (replace) setPosts([]);
        setHasMore(false);
        return;
      }
    }

    let query = supabase
      .from("posts")
      .select("*, author:user_id(username, full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(PAGE);

    if (category) query = query.eq("category", category);
    if (tab === "following") query = query.in("user_id", followingIds);
    if (replace && cursorRef.current) query = query.lt("created_at", cursorRef.current);

    const { data, error } = await query;
    if (error || !data) {
      if (replace) setHasMore(false);
      return;
    }

    const hydrated = await hydratePosts(data as unknown as PostRow[], userId);
    const blocked = await blockedOwnersOf();
    const visible = hydrated.filter((p) => !blocked.has(p.author_id));
    if (visible.length < PAGE) setHasMore(false);
    else setHasMore(true);
    if (data.length > 0) cursorRef.current = data[data.length - 1].created_at;

    setPosts((prev) => (replace ? visible : [...prev, ...visible]));
  };

  const loadFirst = async () => {
    setLoading(true);
    cursorRef.current = null;
    await fetchPage(true);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      loadFirst();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, category, userId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("feed-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        if (!category && tab === "all") loadFirst();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, category]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    await fetchPage(false);
    setLoadingMore(false);
  };

  const removePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="mx-auto w-full max-w-[92vw] overflow-x-clip">
      {/* Tabs */}
      <div className="sticky top-[52px] z-10 flex items-center gap-1 border-b border-edge bg-bg/90 px-4 pt-2 pb-2 backdrop-blur md:top-0">
        {(
          [
            { id: "all", label: "Para vos" },
            { id: "following", label: "Siguiendo" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.id ? "bg-neon text-bg shadow-neon" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={openStreak}
          disabled={loadingStreak || !userId}
          className="ml-auto shrink-0 rounded-full border border-ember/50 bg-ember/10 px-2.5 py-1.5 text-xs font-semibold text-ember transition active:scale-95 disabled:opacity-50 sm:px-3 sm:text-sm"
        >
          {loadingStreak ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
          Racha
        </button>
      </div>

      {/* Categorías */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory((prev) => (prev === c ? null : c))}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
              category === c
                ? "border-neon text-neon shadow-neon"
                : "border-edge bg-card text-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="px-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="mb-3 overflow-hidden rounded-2xl border border-edge bg-card">
                <Skeleton className="aspect-square w-full rounded-none md:aspect-[4/5]" />
              <div className="flex items-center gap-2 p-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        category ? (
          <EmptyState icon={Sparkles} title={`Sin publicaciones en ${category}`} />
        ) : tab === "following" ? (
          <EmptyState
            icon={Users}
            title="Todavía no seguís a nadie"
            subtitle="Descubrí personas y gimnasios en la sección Descubrir."
          />
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Todavía no hay publicaciones"
            subtitle="Creá el primer post con el botón +."
          />
        )
      ) : (
        <>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onDeleted={removePost} />
          ))}
          {hasMore && (
            <div className="px-4 pb-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-edge bg-card py-3 text-sm font-semibold text-neon transition active:scale-[0.98] disabled:opacity-60"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Cargar más</span>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {composer && (
        <PostComposer
          key={composerNonce}
          open
          onClose={() => setComposer(null)}
          title="Compartir mi racha"
          defaultCaption={composer.caption}
          category="#CrossFit"
        />
      )}

          </div>
  );
}
