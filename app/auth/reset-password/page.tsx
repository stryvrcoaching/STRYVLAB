"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { KeyRound, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase injecte le token via le fragment (#) de l'URL — il faut attendre
    // que onAuthStateChange détecte le PASSWORD_RECOVERY event
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      if (error.message.includes("New password should be different")) {
        setError("Le nouveau mot de passe doit être différent de l'ancien.");
      } else {
        setError("Une erreur est survenue. Le lien est peut-être expiré.");
      }
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/coach/clients"), 2500);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 size={36} className="text-[#1f8a65]" />
        <p className="text-white font-semibold">Mot de passe mis à jour</p>
        <p className="text-white/40 text-sm">Redirection en cours…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-1.5">
          Nouveau mot de passe
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Au moins 6 caractères"
          required
          className="w-full h-11 px-4 bg-[#0a0a0a] rounded-xl text-sm text-white outline-none placeholder:text-white/20 transition-colors"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-1.5">
          Confirmer le mot de passe
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Répéter le mot de passe"
          required
          className="w-full h-11 px-4 bg-[#0a0a0a] rounded-xl text-sm text-white outline-none placeholder:text-white/20 transition-colors"
        />
      </div>

      {error && (
        <p className="text-red-400 text-[12px] bg-red-500/10 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {!sessionReady && (
        <p className="text-white/30 text-[11px] text-center">
          Vérification du lien en cours…
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !sessionReady}
        className="group flex h-[52px] w-full items-center justify-between rounded-xl bg-[#1f8a65] pl-5 pr-1.5 transition-all hover:bg-[#217356] active:scale-[0.99] disabled:opacity-50"
      >
        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-white">
          {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
        </span>
        <div className="flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-black/[0.12]">
          {loading ? (
            <Loader2 size={16} className="text-white animate-spin" />
          ) : (
            <ArrowRight size={16} className="text-white" />
          )}
        </div>
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white/[0.02] rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-[#1f8a65]/15 flex items-center justify-center">
            <KeyRound size={16} className="text-[#1f8a65]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
              Sécurité
            </p>
            <p className="text-[13px] font-bold text-white">
              Nouveau mot de passe
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
