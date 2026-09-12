"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Wallet, ArrowUpFromLine, Loader2 } from "lucide-react";
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

export default function BilleteraPage() {
  const { userId } = useAuthState();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const load = async () => {
      const { data } = await supabase.rpc("get_my_wallet");
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
      setLoading(false);
    };
    load();
  }, [userId]);

  const requestWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("request_withdrawal", {
      p_amount: Number(withdrawAmount),
    });
    if (error) {
      alert(error.message);
    } else {
      setWithdrawAmount("");
      setWithdrawing(false);
      // Reload
      const { data } = await supabase.rpc("get_my_wallet");
      if (data) setWallet(data as WalletData);
      if (wallet?.wallet_id) {
        const { data: txData } = await supabase
          .from("wallet_transactions")
          .select("*")
          .eq("wallet_id", wallet.wallet_id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (txData) setTxs(txData as WalletTx[]);
      }
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-md animate-pulse p-4 space-y-4">
        <div className="h-5 w-1/2 rounded bg-card" />
        <div className="h-24 rounded bg-card" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md pb-24">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-edge bg-bg/90 px-4 py-3 backdrop-blur">
        <ArrowLeft onClick={() => history.back()} className="h-5 w-5 cursor-pointer text-muted" />
        <h1 className="text-lg font-bold text-ink">Billetera</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Balance */}
        <div className="rounded-2xl border border-neon/30 bg-neon/5 p-5 text-center">
          <Wallet className="mx-auto mb-2 h-8 w-8 text-neon" />
          <p className="text-xs text-muted">Tu saldo</p>
          <p className="mt-1 text-3xl font-bold text-neon">{formatPrice(wallet?.balance ?? 0)}</p>
          <p className="mt-1 text-[10px] text-muted">
            {wallet?.tx_count ?? 0} movimiento{wallet?.tx_count !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setWithdrawing(true)}
            className="flex flex-col items-center gap-1 rounded-xl border border-edge bg-card py-3 text-xs font-semibold text-ink"
          >
            <ArrowUpFromLine className="h-5 w-5 text-ember" />
            Retirar
          </button>
        </div>

        {/* Withdraw form */}
        {withdrawing && (
          <div className="rounded-xl border border-edge bg-card p-4 space-y-3">
            <p className="text-sm font-semibold text-ink">Solicitar retiro</p>
            <p className="text-[11px] text-muted">
              Solicitás el retiro y el admin lo revisa y transfiere a tu cuenta.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              <input
                type="number"
                inputMode="decimal"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Monto"
                max={wallet?.balance ?? 0}
                className="w-full rounded-lg border border-edge bg-bg py-2 pl-7 pr-3 text-sm text-ink placeholder:text-muted focus:border-neon focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setWithdrawing(false)}
                className="flex-1 rounded-lg border border-edge py-2 text-xs font-semibold text-muted"
              >
                Cancelar
              </button>
              <button
                onClick={requestWithdraw}
                disabled={busy || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > (wallet?.balance ?? 0)}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-neon py-2 text-xs font-semibold text-bg disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Solicitar
              </button>
            </div>
          </div>
        )}

        {/* Bank info */}
        <div className="rounded-xl border border-edge bg-card p-4">
          <p className="text-sm font-semibold text-ink">¿Cómo cargar saldo?</p>
          <p className="mt-1 text-[11px] text-muted leading-relaxed">
            Contactá al administrador para acreditar saldo en tu billetera. Le enviás el comprobante de transferencia y él lo acredita desde el panel admin.
          </p>
        </div>

        {/* Transactions */}
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
