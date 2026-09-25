"use client";

import { Feed } from "@/components/social/Feed";
import { useModuleGuard } from "@/lib/gym-modules";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { busy } = useModuleGuard("feed");
  if (busy) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </div>
    );
  }
  return (
    <div className="w-full">
      <Feed />
    </div>
  );
}
