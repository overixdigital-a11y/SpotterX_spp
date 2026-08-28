"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PostCard, type PostData } from "./PostCard";
import { Loader2 } from "lucide-react";

export function Feed() {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data: postRows, error } = await supabase
        .from("posts")
        .select("*, profiles:user_id(username, full_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error || !postRows || !active) {
        if (active) setLoading(false);
        return;
      }

      const ids = postRows.map((p) => p.id);

      const [{ data: pulses }, { data: comments }] = await Promise.all([
        supabase
          .from("post_pulses")
          .select("post_id", { count: "exact", head: true })
          .in("post_id", ids),
        supabase
          .from("post_comments")
          .select("post_id", { count: "exact", head: true })
          .in("post_id", ids),
      ]);

      if (!active) return;

      setPosts(
        postRows.map((p) => ({
          id: p.id,
          author: p.profiles?.full_name || p.profiles?.username || "Usuario",
          handle: `@${p.profiles?.username || "usuario"}`,
          avatar: (p.profiles?.username || "U").slice(0, 2).toUpperCase(),
          caption: p.caption || "",
          media_url: p.media_url,
          media_type: p.media_type,
          category: p.category,
          pulses: pulses?.length ?? 0,
          comments: comments?.length ?? 0,
          remixes: 0,
        }))
      );
      setLoading(false);
    };

    load();

    // Realtime: nueva publicación
    const channel = supabase
      .channel("feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-muted">Todavía no hay publicaciones.</p>
        <p className="text-sm text-muted/60">
          Creá el primer post con el botón +.
        </p>
      </div>
    );
  }

  return (
    <div>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
