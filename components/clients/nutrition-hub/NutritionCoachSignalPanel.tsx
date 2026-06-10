"use client";

type NutritionInsight = {
  id: string;
  severity: "good" | "watch" | "alert";
  title: string;
  message: string;
};

const SEVERITY_STYLES: Record<NutritionInsight["severity"], string> = {
  good: "border-[#1f8a65]/30 bg-[#1f8a65]/10 text-[#8ef0c7]",
  watch: "border-[#ffd15e]/30 bg-[#ffd15e]/10 text-[#ffd15e]",
  alert: "border-[#ff8660]/30 bg-[#ff8660]/10 text-[#ff9c7e]",
};

const SEVERITY_LABELS: Record<NutritionInsight["severity"], string> = {
  good: "Stable",
  watch: "À surveiller",
  alert: "Prioritaire",
};

export default function NutritionCoachSignalPanel({
  insights,
}: {
  insights: NutritionInsight[];
}) {
  const visibleInsights = insights.slice(0, 3);

  return (
    <section className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
            Signaux coach
          </p>
          <h2 className="mt-2 text-[18px] font-semibold text-white">
            Lecture prioritaire
          </h2>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/45">
          {visibleInsights.length} signaux
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {visibleInsights.length > 0 ? (
          visibleInsights.map((insight, index) => (
            <article
              key={insight.id}
              className="rounded-[22px] border border-white/[0.06] bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${SEVERITY_STYLES[insight.severity]}`}
                >
                  {SEVERITY_LABELS[insight.severity]}
                </span>
                <span className="text-[11px] text-white/30">Signal {index + 1}</span>
              </div>
              <h3 className="mt-3 text-[15px] font-semibold text-white">
                {insight.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/56">
                {insight.message}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white/78">
              Aucun signal critique sur la fenêtre active.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/52">
              Les données observées restent globalement cohérentes. Continue à suivre
              les journées les plus récentes pour détecter un changement de tendance.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
