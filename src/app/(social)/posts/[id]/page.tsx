"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { PostCard, type PostData } from "@/components/social/PostCard";
import { CommentsList } from "@/components/social/CommentsList";
import { hydratePosts, type PostRow } from "@/lib/posts";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const { userId } = useAuthState();
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, author:user_id(username, full_name, avatar_url)")
        .eq("id", params.id)
        .maybeSingle();
      if (!active || !data) {
        if (active) setLoading(false);
        return;
      }
      const hydrated = await hydratePosts([data as unknown as PostRow], userId);
      if (active) {
        setPost(hydrated[0] ?? null);
        setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [params.id, userId]);

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </main>
    );
  }

  if (!post) {
    return (
      <main className="px-4 py-16 text-center">
        <p className="text-muted">Publicación no encontrada o eliminada.</p>
        <Link href="/home" className="mt-4 inline-block text-sm font-semibold text-neon">
          Volver al inicio
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-full">
      <div className="sticky top-[52px] z-10 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur md:top-0">
        <Link href="/home" className="text-muted transition hover:text-ink">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-bold text-ink">Publicación</h1>
      </div>

      <div className="pt-2">
        <PostCard post={post} onDeleted={() => setPost(null)} />
      </div>

      <div className="px-4 pb-16">
        <p className="mb-3 text-sm font-bold text-ink">Comentarios</p>
        <CommentsList postId={post.id} viewerId={userId} />
      </div>
    </main>
  );
}