"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Loader2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { Avatar } from "@/components/core/Avatar";
import { PostCard, type PostData } from "@/components/social/PostCard";
import { hydratePosts, type PostRow } from "@/lib/posts";
import { EmptyState } from "@/components/core/EmptyState";

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

interface Person {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

export default function DiscoverPage() {
  return (
    <Suspense>
      <Discover />
    </Suspense>
  );
}

function Discover() {
  const searchParams = useSearchParams();
  const { userId } = useAuthState();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(searchParams.get("cat"));
  const [people, setPeople] = useState<Person[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  // Sugerencias: a quién seguir
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    (async () => {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      const followed = ((follows as { following_id: string }[] | null) ?? []).map(
        (f) => f.following_id
      );
      let query = supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, role")
        .neq("id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (followed.length > 0) {
        query = query.filter("id", "not.in", `(${followed.join(",")})`);
      }
      const { data } = await query;
      if (active && data) setSuggestions((data as Person[]).slice(0, 6));
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // Búsqueda de personas
  useEffect(() => {
    const supabase = createClient();
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setPeople([]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, role")
        .or(`username.ilike.%${q.trim()}%,full_name.ilike.%${q.trim()}%`)
        .limit(12);
      setPeople((data as Person[]) ?? []);
    }, q.trim() ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);

  // Posts: por categoría o por texto
  useEffect(() => {
    const term = q.trim();
    const supabase = createClient();
    let active = true;
    const run = async () => {
      if (!term && !cat) {
        setPosts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      let query = supabase
        .from("posts")
        .select("*, author:user_id(username, full_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (cat) query = query.eq("category", cat);
      else if (term) query = query.ilike("caption", `%${term}%`);
      const { data } = await query;
      if (!active) return;
      const hydrated = await hydratePosts((data as unknown as PostRow[]) ?? [], userId);
      if (active) setPosts(hydrated);
      if (active) setLoading(false);
    };
    const t = setTimeout(run, 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, cat, userId]);

  const follow = async (p: Person) => {
    if (!userId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: userId, following_id: p.id });
    if (!error) setSuggestions((prev) => prev.filter((x) => x.id !== p.id));
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 rounded-xl border border-edge bg-card px-3 py-2.5">
        <Search className="h-4 w-4 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar personas o publicaciones…"
          className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      {/* Categorías */}
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => {
              setCat((prev) => (prev === c ? null : c));
              setQ("");
            }}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              cat === c
                ? "border-neon text-neon shadow-neon"
                : "border-edge bg-card text-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Resultados de posts */}
      {(q.trim() || cat) && loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-neon" />
        </div>
      )}

      {(q.trim() || cat) && !loading && posts.length === 0 && (
        <p className="py-10 text-center text-sm text-muted">Sin publicaciones.</p>
      )}

      {(q.trim() || cat) && !loading && posts.length > 0 && (
        <div className="mt-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      {/* Resultados de personas */}
      {q.trim() && people.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Personas
          </p>
          <div className="mt-2">
            {people.map((r) => (
              <Link
                key={r.id}
                href={`/perfil/${r.username}`}
                className="flex items-center gap-3 border-b border-edge py-3"
              >
                <Avatar
                  src={r.avatar_url}
                  name={r.full_name}
                  username={r.username}
                  size="sm"
                  ring={false}
                />
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-ink">
                    {r.full_name || r.username}
                  </p>
                  <p className="text-xs text-muted">@{r.username} · {r.role}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sugerencias: a quién seguir */}
      {!q.trim() && !cat && suggestions.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            A quién seguir
          </p>
          <div className="mt-2 space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-edge bg-card p-2.5"
              >
                <Link href={`/perfil/${s.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar
                    src={s.avatar_url}
                    name={s.full_name}
                    username={s.username}
                    size="sm"
                    ring={false}
                  />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-semibold text-ink">
                      {s.full_name || s.username}
                    </p>
                    <p className="truncate text-xs text-muted">@{s.username}</p>
                  </div>
                </Link>
                <button
                  onClick={() => follow(s)}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-neon px-2.5 py-1.5 text-xs font-semibold text-bg shadow-neon transition active:scale-95"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Seguir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!q.trim() && !cat && (
        <EmptyState
          icon={Search}
          title="Buscá gente y contenidos"
          subtitle="O explorá las categorías de arriba."
        />
      )}
    </div>
  );
}