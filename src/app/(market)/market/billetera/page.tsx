"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wallet, PlusCircle, Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthState } from "@/lib/auth-context";
import { formatPrice } from "@/lib/market";

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  reference: string | null;
  note: string | null;
  created_at: string;
}

interface WalletData {
  balance: number;
  tx_count: number;
  wallet_id: string | null;
}

interface MyDeposit {
  id: string;
  pedido: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function BilleteraPage() {
  const { userId } = useAuthState();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [deposits, setDeposits] = useState<MyDeposit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const load = async () => {
      const [{ data }, depRes] = await Promise.all([
        supabase.rpc("get_my_wallet"),
        supabase
          .from("publish_deposits")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (data) {
        setWallet(data as WalletData);
        if (data.wallet_id) {
          const { data: txData } = await supabase
            .from("wallet_transactions")
            .select("*")
            .eq("wallet_id", data.wallet_id)
            .order("created_at", { ascending: false })
            .limit(50);
          if (txData) setTxs(txData as WalletTx[]);
        }
      }
      if (depRes.data) setDeposits(depRes.data as MyDeposit[]);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-md animate-pulse p-4 space-y-4">
        <div className="h-5 w-1/2 rounded bg-card" />
        <div className="h-24 rounded bg-card" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-3xl">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur">
        <Link href="/market">
          <ArrowLeft className="h-5 w-5 cursor-pointer text-muted" />
        </Link>
        <h1 className="text-lg font-bold text-ink">Billetera</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-2xl border border-neon/30 bg-neon/5 p-5 text-center">
          <Wallet className="mx-auto mb-2 h-8 w-8 text-neon" />
          <p className="text-xs text-muted">Tu saldo</p>
          <p className="mt-1 text-3xl font-bold text-neon">{formatPrice(wallet?.balance ?? 0)}</p>
          <p className="mt-1 text-[10px] text-muted">
            {wallet?.tx_count ?? 0} movimiento{wallet?.tx_count !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="rounded-xl border border-edge bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-ink">¿Para qué sirve mi saldo?</p>
          <p className="text-[11px] text-muted leading-relaxed">
            Solo se usa para <b className="text-ink">pagar publicaciones</b> en SpotterShop cuando se
            te acaba el cupo gratis. Al publicar un producto se descuenta el costo de acá.
          </p>
          <Link
            href="/market/crear"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-neon py-2 text-xs font-bold text-bg"
          >
            <PlusCircle className="h-4 w-4" /> Publicar un producto
          </Link>
        </div>

        <div className="rounded-xl border border-edge bg-card p-4">
          <p className="text-sm font-semibold text-ink">¿Cómo cargo saldo?</p>
          <p className="mt-1 text-[11px] text-muted leading-relaxed">
            Cuando te quede una publicación paga, vas a ver los datos de la cuenta del
            administrador para transferirle. Avisás con el botón{" "}
            <b className="text-ink">«Hice el depósito»</b>, te dan un pedido y el admin te acredita
            el saldo.
          </p>
        </div>

        {deposits.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Mis depósitos</h3>
            <div className="space-y-2">
              {deposits.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-400">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink">{d.pedido}</p>
                      <p className="text-[10px] text-muted">
                        {new Date(d.created_at).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-ink">{formatPrice(d.amount)}</p>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        d.status === "acreditado"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-yellow-500/15 text-yellow-400"
                      }`}
                    >
                      {d.status === "acreditado" ? "Acreditado" : "Pendiente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Historial</h3>
          {txs.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Sin movimientos todavía</p>
          ) : (
            <div className="space-y-2">
              {txs.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-edge bg-card p-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    tx.type === "credit" ? "bg-green-500/15 text-green-400"
                      : tx.type === "debit" ? "bg-neon/15 text-neon"
                      : tx.type === "commission" ? "bg-ember/15 text-ember"
                      : tx.type === "withdrawal_request" ? "bg-yellow-500/15 text-yellow-400"
                      : "bg-muted/15 text-muted"
                  }`}>
                    {tx.type === "credit" ? "↓" : tx.type === "debit" || tx.type === "commission" ? "↑" : "⟳"}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-ink">
                      {tx.note ?? tx.type}
                    </p>
                    <p className="text-[10px] text-muted">
                      {new Date(tx.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className={`text-xs font-bold ${tx.amount >= 0 ? "text-green-400" : "text-ember"}`}>
                    {tx.amount >= 0 ? "+" : ""}{formatPrice(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}