"use client";

import { useState } from "react";
import { MessageCircle, Play, Zap } from "lucide-react";
import type { PostData } from "@/components/social/PostCard";
import { PostCard } from "@/components/social/PostCard";
import { BottomSheet } from "@/components/core/BottomSheet";
import { formatNumber } from "@/lib/format";

export function ProfileGrid({ posts }: { posts: PostData[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openPost = posts.find((p) => p.id === openId) ?? null;

  if (posts.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted">
        Sin publicaciones todavía
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1 p-1">
        {posts.map((p) => (
          <button
            key={p.id}
            onClick={() => setOpenId(p.id)}
            className="group relative aspect-square overflow-hidden rounded-lg bg-card"
          >
            {p.media_url ? (
              p.media_type === "video" ? (
                <video
                  src={p.media_url}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.media_url}
                  alt={p.caption || ""}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              )
            ) : (
              <Zap className="h-full w-full p-5 text-neon/50" />
            )}
            {p.media_type === "video" && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-bg/70 p-1 text-muted backdrop-blur">
                <Play className="h-3 w-3 fill-current" />
              </span>
            )}
            {p.pulses > 0 || p.comments > 0 ? (
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] font-bold text-white">
                <span className="flex items-center gap-0.5">
                  <Zap className="h-3 w-3 fill-neon text-neon" />
                  {formatNumber(p.pulses)}
                </span>
                <span className="flex items-center gap-0.5">
                  <MessageCircle className="h-3 w-3 text-neon" />
                  {formatNumber(p.comments)}
                </span>
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <BottomSheet open={!!openPost} onClose={() => setOpenId(null)}>
        {openPost && <PostCard post={openPost} />}
      </BottomSheet>
    </div>
  );
}