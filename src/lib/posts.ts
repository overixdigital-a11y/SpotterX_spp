import { createClient } from "@/lib/supabase/client";
import type { PostData } from "@/components/social/PostCard";

export interface PostRow {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: "video" | "image" | null;
  category: string | null;
  created_at: string;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export async function hydratePosts(
  rows: PostRow[],
  userId: string | null
): Promise<PostData[]> {
  const ids = rows.map((p) => p.id);
  if (ids.length === 0) return [];
  const supabase = createClient();

  const pulsesCount = new Map<string, number>();
  const pulsedSet = new Set<string>();
  const savesCount = new Map<string, number>();
  const savedSet = new Set<string>();
  const commentsCount = new Map<string, number>();

  const [pulsesRes, savesRes, commentsRes] = await Promise.all([
    supabase.from("post_pulses").select("post_id, user_id").in("post_id", ids),
    supabase.from("post_saves").select("post_id, user_id").in("post_id", ids),
    supabase.from("post_comments").select("post_id").in("post_id", ids),
  ]);

  for (const r of pulsesRes.data ?? []) {
    pulsesCount.set(r.post_id, (pulsesCount.get(r.post_id) ?? 0) + 1);
    if (userId && r.user_id === userId) pulsedSet.add(r.post_id);
  }
  for (const r of savesRes?.data ?? []) {
    savesCount.set(r.post_id, (savesCount.get(r.post_id) ?? 0) + 1);
    if (userId && r.user_id === userId) savedSet.add(r.post_id);
  }
  for (const r of commentsRes?.data ?? []) {
    commentsCount.set(r.post_id, (commentsCount.get(r.post_id) ?? 0) + 1);
  }

  return rows.map((p) => ({
    id: p.id,
    author_id: p.user_id,
    author_name: p.author?.full_name || p.author?.username || "Usuario",
    username: p.author?.username || "usuario",
    avatar_url: p.author?.avatar_url ?? null,
    caption: p.caption || "",
    media_url: p.media_url,
    media_type: p.media_type,
    category: p.category,
    created_at: p.created_at,
    pulses: pulsesCount.get(p.id) ?? 0,
    pulsed: pulsedSet.has(p.id),
    comments: commentsCount.get(p.id) ?? 0,
    saves: savesCount.get(p.id) ?? 0,
    saved: savedSet.has(p.id),
  }));
}