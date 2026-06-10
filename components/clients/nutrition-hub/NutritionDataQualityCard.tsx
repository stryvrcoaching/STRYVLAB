"use client";

type NutritionDataQuality = {
  validDays: number;
  partialDays: number;
  missingMealDays: number;
  missingHydrationDays: number;
};

export default function NutritionDataQualityCard({
  dataQuality,
}: {
  dataQuality: NutritionDataQuality;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4 md:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        Qualité des données
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl bg-white/[0.03] p-4">
          <p className="text-2xl font-semibold text-white">{dataQuality.validDays}</p>
          <p className="mt-1 text-[11px] text-white/45">Jours valides</p>
        </article>
        <article className="rounded-2xl bg-white/[0.03] p-4">
          <p className="text-2xl font-semibold text-white">{dataQuality.partialDays}</p>
          <p className="mt-1 text-[11px] text-white/45">Jours partiels</p>
        </article>
        <article className="rounded-2xl bg-white/[0.03] p-4">
          <p className="text-2xl font-semibold text-white">{dataQuality.missingMealDays}</p>
          <p className="mt-1 text-[11px] text-white/45">Repas absents</p>
        </article>
        <article className="rounded-2xl bg-white/[0.03] p-4">
          <p className="text-2xl font-semibold text-white">
            {dataQuality.missingHydrationDays}
          </p>
          <p className="mt-1 text-[11px] text-white/45">Hydratation absente</p>
        </article>
      </div>
    </section>
  );
}
