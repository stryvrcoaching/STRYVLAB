"use client";

import { useEffect, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";

type AnalyticsPayload = {
  totals: {
    views: number;
    cta_clicks: number;
    formula_clicks: number;
    shares: number;
  };
  last7Days: {
    views: number;
    cta_clicks: number;
  };
};

export function AnalyticsCard() {
  // Collapsed by default — frees space for Sections / Apparence above
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Lazy fetch only when first expanded
  useEffect(() => {
    if (!open || loaded) return;

    let cancelled = false;
    void fetch("/api/coach-page/analytics")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erreur");
        if (!cancelled) {
          setData(json);
          setLoaded(true);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0a0a0a] p-3.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg text-left transition-colors duration-150 hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 active:scale-[0.99]"
      >
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-white/50">
          <BarChart3 className="h-3.5 w-3.5 text-[#1f8a65]" aria-hidden />
          Statistiques
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-white/35">
          {open ? "Masquer" : "Afficher"}
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
        </span>
      </button>

      {open ? (
        <div className="mt-3">
          <p className="mb-2 text-[10px] tabular-nums text-white/30">
            7 j / total
          </p>

          {error ? (
            <p className="text-[11px] text-white/35">
              Stats indisponibles pour le moment.
            </p>
          ) : null}

          {!error && !data ? (
            <p className="text-[11px] text-white/35">Chargement…</p>
          ) : null}

          {data ? (
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Vues"
                primary={data.last7Days.views}
                secondary={data.totals.views}
              />
              <Stat
                label="Clics CTA"
                primary={data.last7Days.cta_clicks}
                secondary={data.totals.cta_clicks}
              />
              <Stat
                label="Formules"
                primary={data.totals.formula_clicks}
                secondary={null}
              />
              <Stat
                label="Partages"
                primary={data.totals.shares}
                secondary={null}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: number;
  secondary: number | null;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <p className="text-[10px] text-white/35">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
        {primary}
        {secondary !== null && (
          <span className="text-[10px] font-medium text-white/30">
            {" "}
            / {secondary}
          </span>
        )}
      </p>
    </div>
  );
}
