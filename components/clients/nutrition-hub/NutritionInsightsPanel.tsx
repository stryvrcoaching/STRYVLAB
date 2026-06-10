"use client";

type NutritionInsight = {
  id: string;
  severity: "good" | "watch" | "alert";
  title: string;
  message: string;
};

const SEVERITY_TONE: Record<NutritionInsight["severity"], string> = {
  good: "text-[#7fe2bf]",
  watch: "text-[#ffd15e]",
  alert: "text-[#ff8660]",
};

export default function NutritionInsightsPanel({
  insights,
}: {
  insights: NutritionInsight[];
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4 md:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        Coach Insights
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight) => (
          <article
            key={insight.id}
            className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-4"
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.16em] ${SEVERITY_TONE[insight.severity]}`}
            >
              {insight.severity}
            </p>
            <h3 className="mt-2 text-sm font-semibold text-white">
              {insight.title}
            </h3>
            <p className="mt-2 text-[12px] leading-relaxed text-white/55">
              {insight.message}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
