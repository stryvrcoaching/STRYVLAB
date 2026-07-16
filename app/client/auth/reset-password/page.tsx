"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useClientT } from "@/components/client/ClientI18nProvider";

function ClientResetPasswordForm() {
  const router = useRouter();
  const { t } = useClientT();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hashParams.get("type") === "recovery" && hashParams.get("access_token")) {
      setSessionReady(true);
    }

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

    if (password.length < 8) {
      setError(t("onboarding.password.error.length"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("onboarding.password.error.mismatch"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      if (error.message.includes("New password should be different")) {
        setError(t("password.reset.error.reused"));
      } else {
        setError(t("password.reset.error.failed"));
      }
      return;
    }

    setSuccess(true);
    window.setTimeout(() => router.push("/client/login"), 2200);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 size={36} className="text-[#1f8a65]" />
        <div>
          <p className="text-white font-semibold">{t("password.reset.success.title")}</p>
          <p className="text-sm text-white/40">{t("password.reset.success.desc")}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
          {t("password.reset.title")}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("onboarding.password.placeholder")}
          required
          className="h-12 w-full rounded-xl bg-[#222222] px-4 text-sm text-white outline-none placeholder:text-white/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
          {t("onboarding.password.confirm")}
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t("onboarding.password.placeholder.confirm")}
          required
          className="h-12 w-full rounded-xl bg-[#222222] px-4 text-sm text-white outline-none placeholder:text-white/20"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-[12px] text-red-400">
          {error}
        </p>
      )}

      {!sessionReady && (
        <p className="text-center text-[11px] text-white/30">
          {t("password.reset.pending")}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !sessionReady}
        className="group flex h-[52px] w-full items-center justify-between rounded-xl bg-[#f2f2f2] pl-5 pr-1.5 transition-all hover:bg-white active:scale-[0.99] disabled:opacity-50"
      >
        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#080808]">
          {loading ? t("password.reset.submitting") : t("password.reset.submit")}
        </span>
        <div className="flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-black/[0.12]">
          {loading ? (
            <Loader2 size={16} className="animate-spin text-[#080808]" />
          ) : (
            <ArrowRight size={16} className="text-[#080808]" />
          )}
        </div>
      </button>
    </form>
  );
}

export default function ClientResetPasswordPage() {
  const { t } = useClientT();
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-[#0d0d0d] p-6"
      style={{
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white/[0.02] p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-[#181818]">
            <Image src="/logo/logo-stryvr-silver.png" alt="STRYVR" width={32} height={32} className="h-8 w-8 object-contain" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
              {t("password.reset.kicker")}
            </p>
            <p className="text-[13px] font-bold text-white">
              {t("password.reset.title")}
            </p>
          </div>
        </div>

        <p className="mb-6 text-[12px] leading-relaxed text-white/45">
          {t("password.reset.subtitle")}
        </p>

        <Suspense fallback={null}>
          <ClientResetPasswordForm />
        </Suspense>

        <button
          type="button"
          onClick={() => window.location.assign("/client/login")}
          className="mt-4 w-full text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 transition-colors hover:text-white/60"
        >
          {t("password.reset.backToLogin")}
        </button>
      </div>
    </main>
  );
}
