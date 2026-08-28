"use client";

import { useState } from "react";
import { Zap, MessageCircle, Repeat2, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";

export interface PostData {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  caption: string;
  media_url: string | null;
  media_type: "video" | "image" | null;
  category: string | null;
  pulses: number;
  comments: number;
  remixes: number;
}

export function PostCard({ post }: { post: PostData }) {
  const { userId } = useAuthState();
  const [pulsed, setPulsed] = useState(false);
  const [pulses, setPulses] = useState(post.pulses);
  const [liked, setLiked] = useState(false);

  const onPulse = async () => {
    if (!userId) return;
    const supabase = createClient();
    if (pulsed) {
      await supabase
        .from("post_pulses")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", userId);
      setPulses((n) => n - 1);
      setPulsed(false);
    } else {
      await supabase.from("post_pulses").insert({ post_id: post.id, user_id: userId });
      setPulses((n) => n + 1);
      setPulsed(true);
    }
  };

  const renderMedia = () => {
    if (!post.media_url) {
      return (
        <div className="flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
          <div className="text-center">
            <Heart
              className={`mx-auto h-10 w-10 ${liked ? "fill-ember text-ember" : "text-muted"}`}
              onClick={() => setLiked((v) => !v)}
            />
            <p className="mt-2 text-xs text-muted">{post.category || ""}</p>
          </div>
        </div>
      );
    }
    if (post.media_type === "video") {
      return (
        <video
          src={post.media_url}
          controls
          muted
          loop
          playsInline
          className="aspect-[4/5] w-full bg-bg object-cover"
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.media_url}
        alt={post.caption || ""}
        className="aspect-[4/5] w-full bg-bg object-cover"
      />
    );
  };

  return (
    <article className="relative mb-3 overflow-hidden rounded-2xl border border-edge bg-card">
      {renderMedia()}

      <div className="flex items-center gap-2 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neon/20 text-xs font-bold text-neon">
          {post.avatar}
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">{post.author}</p>
          <p className="text-xs text-muted">{post.handle}</p>
        </div>
      </div>

      {post.caption && (
        <p className="px-3 pb-3 text-sm text-ink">{post.caption}</p>
      )}

      <div className="absolute bottom-3 right-2.5 flex flex-col items-center gap-3">
        <button
          onClick={onPulse}
          className="flex flex-col items-center gap-0.5 text-neon transition active:scale-90"
        >
          <Zap className={`h-7 w-7 ${pulsed ? "fill-neon text-neon" : ""}`} />
          <span className="text-[11px] font-semibold">{pulses}</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-muted transition active:scale-90">
          <MessageCircle className="h-7 w-7" />
          <span className="text-[11px]">{post.comments}</span>
        </button>
        <button className="flex flex-col items-center gap-0.5 text-muted transition active:scale-90">
          <Repeat2 className="h-7 w-7" />
          <span className="text-[11px]">{post.remixes}</span>
        </button>
      </div>
    </article>
  );
}
