import { AuthProvider } from "@/lib/auth-context";

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
