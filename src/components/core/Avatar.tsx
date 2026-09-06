"use client";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  username?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  ring?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizes = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-20 w-20 text-2xl",
} as const;

export function Avatar({
  src,
  name,
  username,
  size = "md",
  ring = true,
  onClick,
  className = "",
}: AvatarProps) {
  const fallback = (name || username || "U").slice(0, 2).toUpperCase();
  const base = `relative shrink-0 overflow-hidden rounded-full ${sizes[size]} ${className}`;
  const ringCls = ring ? "border-2 border-neon shadow-neon" : "";
  const clickable = onClick ? "cursor-pointer" : "";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={fallback}
        onClick={onClick}
        className={`${base} ${ringCls} ${clickable} object-cover`}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      className={`${base} ${ringCls} ${clickable} flex items-center justify-center bg-neon/20 font-bold text-neon`}
    >
      {fallback}
    </div>
  );
}