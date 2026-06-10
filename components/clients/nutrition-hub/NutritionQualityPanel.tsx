"use client";

type NutritionDataQuality = {
  validDays: number;
  partialDays: number;
  missingMealDays: number;
  missingHydrationDays: number;
};

export default function NutritionQualityPanel({
  dataQuality,
}: {
  dataQuality: NutritionDataQuality;
}) {
  return (
    <section className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
            Fiabilité des données
          </p>
          <h2 className="mt-2 text-[18px] font-semibold text-white">
            Qualité des données
          </h2>
        </div>
        <p className="max-w-md text-[13px] leading-relaxed text-white/52">
          Ce bloc aide le coach à nuancer son interprétation avant d’ajuster le
          protocole nutritionnel.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[30px] font-semibold text-white">{dataQuality.validDays}</p>
          <p className="mt-2 text-[12px] text-white/46">Jours valides</p>
        </article>
        <article className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[30px] font-semibold text-white">{dataQuality.partialDays}</p>
          <p className="mt-2 text-[12px] text-white/46">Jours partiels</p>
        </article>
        <article className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[30px] font-semibold text-white">
            {dataQuality.missingMealDays}
          </p>
          <p className="mt-2 text-[12px] text-white/46">Repas absents</p>
        </article>
        <article className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[30px] font-semibold text-white">
            {dataQuality.missingHydrationDays}
          </p>
          <p className="mt-2 text-[12px] text-white/46">Hydratation absente</p>
        </article>
      </div>
    </section>
  );
}
