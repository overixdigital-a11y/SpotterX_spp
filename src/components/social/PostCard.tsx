"use client";

import { useState } from "react";
import { Zap, MessageCircle, Repeat2, Heart } from "lucide-react";

export interface PostData {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  caption: string;
  pulses: number;
  comments: number;
  remixes: number;
}

export function PostCard({ post }: { post: PostData }) {
  const [pulsed, setPulsed] = useState(false);
  const [pulses, setPulses] = useState(post.pulses);
  const [liked, setLiked] = useState(false);

  const onPulse = () => {
    setPulsed((v) => !v);
    setPulses((n) => n + (pulsed ? -1 : 1));
  };

  return (
    <article className="relative mb-3 overflow-hidden rounded-2xl border border-edge bg-card">
      {/* Media placeholder */}
      <div className="flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-elevated to-bg">
        <div className="text-center">
          <Heart
            className={`mx-auto h-10 w-10 ${liked ? "fill-ember text-ember" : "text-muted"}`}
            onClick={() => setLiked((v) => !v)}
          />
          <p className="mt-2 text-xs text-muted">Video aquí</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neon/20 text-xs font-bold text-neon">
          {post.avatar}
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">{post.author}</p>
          <p className="text-xs text-muted">{post.handle}</p>
        </div>
      </div>

      {/* Caption */}
      <p className="px-3 pb-3 text-sm text-ink">{post.caption}</p>

      {/* Actions flotantes (Pulse / Dialogue / Remix) */}
      <div className="absolute bottom-3 right-2.5 flex flex-col items-center gap-3">
        <button
          onClick={onPulse}
          className="flex flex-col items-center gap-0.5 text-neon transition active:scale-90"
        >
          <Zap
            className={`h-7 w-7 ${pulsed ? "fill-neon text-neon" : ""}`}
          />
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
