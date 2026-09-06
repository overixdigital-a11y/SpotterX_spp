"use client";

import type { ReactNode, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-neon text-bg shadow-neon",
  outline: "border border-edge bg-card text-ink",
  ghost: "text-muted hover:text-ink",
  danger: "border border-ember/40 bg-ember/10 text-ember",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs font-semibold",
  md: "px-4 py-2.5 text-sm font-semibold",
  lg: "px-4 py-3 text-sm font-bold",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition active:scale-[0.98] disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}