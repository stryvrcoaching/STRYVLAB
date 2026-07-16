"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, Loader2, Minus, X } from "lucide-react";
import {
  PLAN_LIMITS,
  type BillingStatus,
  type CoachPlan,
} from "@/lib/billing/plans";

type StripePlanPrice = {
  amount: number;
  currency: string;
  interval: "day" | "week" | "month" | "year" | null;
  intervalCount: number | null;
};

type PlanComparisonModalProps = {
  open: boolean;
  currentPlan: CoachPlan;
  billingStatus: BillingStatus;
  hasConsumedTrial: boolean;
  choosingPlan: CoachPlan | null;
  onClose: () => void;
  onChoose: (plan: CoachPlan) => void;
};

const PLANS: CoachPlan[] = ["solo", "pro", "studio"];

const PLAN_DESCRIPTIONS: Record<CoachPlan, string> = {
  solo: "Pour gérer votre coaching depuis STRYV lab.",
  pro: "Pour relier votre coaching à STRYVR.",
  studio: "Pour suivre plus d’athlètes avec STRYVR.",
};

type PlanFeature = {
  label: string;
  detail: string;
  availability: Partial<Record<CoachPlan, "included" | "soon">>;
};

const FEATURE_GROUPS: Array<{ title: string; features: PlanFeature[] }> = [
  {
    title: "Suivi et pilotage",
    features: [
      { label: "Dossiers athlètes", detail: "Profil, objectifs, historique, données et contexte de suivi au même endroit.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Bilans personnalisés", detail: "Créer, prévisualiser, dupliquer et envoyer des bilans adaptés à votre suivi.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Métriques croisées", detail: "Lire ensemble les données corporelles, la nutrition, le sommeil, la performance et la récupération.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Historique et événements", detail: "Retrouver les phases du suivi sur les courbes et y ajouter blessures, voyages, notes ou changements de protocole.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Normes biométriques", detail: "Comparer les mesures à des repères de composition corporelle, santé métabolique et morphométrie.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Morpho Pro", detail: "Comparer des photos, annoter et suivre l’évolution visuelle pour éclairer la prescription.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Cockpit client", detail: "Voir le réel, le plan, l’adhérence, l’activité, la récupération et l’impact d’un brouillon coach.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Actions coach", detail: "Depuis toute page coach, créer un rappel, une tâche Kanban ou les deux à partir du contexte en cours.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Formules et paiements", detail: "Gérer les formules client, les encaissements et l’administratif lié au suivi.", availability: { solo: "included", pro: "included", studio: "included" } },
    ],
  },
  {
    title: "Prescription et aide à la décision",
    features: [
      { label: "Workout Studio", detail: "Construire séances, exercices, séries, RIR, tempo, repos, supersets et alternatives personnalisées.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Mésocycles 2 à 12 semaines", detail: "Prévisualiser volume, RIR et semaine de décharge avant d’appliquer une progression au programme.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Smart Fit", detail: "Vérifier l’équilibre, le volume, les mouvements et les alertes d’un programme avant de le partager.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Nutrition Studio", detail: "Construire calories, macros, hydratation, repas et jours types à partir de la dépense de la personne.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "TDEE adaptatif", detail: "Estimer la dépense réelle à partir des apports et du poids, sans sur-réagir aux variations du quotidien.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "CycleSync — suivi du cycle menstruel", detail: "Adapter les objectifs nutritionnels selon le cycle, dans le cadre choisi par le coach.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Rééquilibrage calorique", detail: "Répartir un écart important sur les jours suivants sans modifier les données passées.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Score de transformation", detail: "Comprendre la dynamique globale grâce à l’adhérence, la récupération, le corps et la performance.", availability: { solo: "included", pro: "included", studio: "included" } },
      { label: "Optimisation de phase", detail: "Vérifier si la phase actuelle est adaptée et obtenir une piste de travail, sans remplacer le jugement du coach.", availability: { solo: "included", pro: "included", studio: "included" } },
    ],
  },
  {
    title: "STRYVR — application client",
    features: [
      { label: "Application client STRYVR", detail: "Un espace personnel pour retrouver sa journée, ses actions et les repères transmis par son coach.", availability: { pro: "included", studio: "included" } },
      { label: "Exécution et progression de séance", detail: "Noter la séance et recevoir un repère pour la série suivante ou la prochaine séance.", availability: { pro: "included", studio: "included" } },
      { label: "Ce qui a été réellement fait", detail: "Faire remonter au coach les séances terminées, charges, répétitions, RIR, repos et tendance de performance.", availability: { pro: "included", studio: "included" } },
      { label: "Nutrition planifiée et journal réel", detail: "Voir le plan du jour, organiser les repas, enregistrer les apports et l’hydratation.", availability: { pro: "included", studio: "included" } },
      { label: "Impact nutritionnel en temps réel", detail: "Voir l’effet des repas sur les calories et les macros de la journée avant de faire ses choix.", availability: { pro: "included", studio: "included" } },
      { label: "Repas par photo ou par voix", detail: "Enregistrer plus vite un repas à partir d’une photo guidée ou d’une note vocale.", availability: { pro: "included", studio: "included" } },
      { label: "CycleSync côté client", detail: "Voir la phase et les objectifs ajustés ; les confirmations de règles affinent ensuite le suivi.", availability: { pro: "included", studio: "included" } },
      { label: "Check-ins et retours quotidiens", detail: "Faire remonter sommeil, énergie, stress, courbatures et retours structurés dans le bon contexte coach.", availability: { pro: "included", studio: "included" } },
      { label: "Progression et repères personnels", detail: "Consulter données corporelles, mensurations, vitalité, séances et évolution du parcours.", availability: { pro: "included", studio: "included" } },
      { label: "Messages et rappels", detail: "Garder les échanges et les rappels importants liés au suivi de la personne.", availability: { pro: "included", studio: "included" } },
      { label: "Saisie hors connexion", detail: "Conserver les repas et l’hydratation saisis sans réseau, puis les synchroniser au retour en ligne.", availability: { pro: "included", studio: "included" } },
    ],
  },
  {
    title: "Engagement client",
    features: [
      { label: "Points, rangs et régularité", detail: "Valoriser les séances, repas, bilans et check-ins réalisés au fil du temps.", availability: { pro: "included", studio: "included" } },
      { label: "Boutique de récompenses", detail: "Créer des récompenses et valider les demandes du client tout en gardant le contrôle des points.", availability: { pro: "included", studio: "included" } },
      { label: "Suivi de la régularité", detail: "Repérer les habitudes et les signaux utiles avant qu’une personne ne décroche.", availability: { pro: "included", studio: "included" } },
    ],
  },
  {
    title: "Travail en équipe — bientôt",
    features: [
      { label: "Espace multi-coachs", detail: "Partager l’activité entre plusieurs coachs dans un même espace.", availability: { studio: "soon" } },
      { label: "Rôles et accès", detail: "Organiser les responsabilités et l’accès aux informations de l’équipe.", availability: { studio: "soon" } },
      { label: "Vue d’équipe", detail: "Suivre l’activité de l’équipe de coaching dans une même vue.", availability: { studio: "soon" } },
    ],
  },
];

function formatPrice(price: StripePlanPrice | null | undefined) {
  if (!price) return "Tarif à venir";

  const amount = new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: price.currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(price.amount / 100);

  if (!price.interval) return amount;
  const period = price.interval === "month" ? "mois" : price.interval === "year" ? "an" : price.interval === "week" ? "semaine" : "jour";
  return `${amount} / ${price.intervalCount && price.intervalCount > 1 ? `${price.intervalCount} ${period}s` : period}`;
}

function limitLabel(plan: CoachPlan) {
  const limit = PLAN_LIMITS[plan].clientLimit;
  return limit === null ? "Illimité" : `${limit} athlètes`;
}

export default function PlanComparisonModal({
  open,
  currentPlan,
  billingStatus,
  hasConsumedTrial,
  choosingPlan,
  onClose,
  onChoose,
}: PlanComparisonModalProps) {
  const [prices, setPrices] = useState<Partial<Record<CoachPlan, StripePlanPrice | null>>>({});
  const [pricesLoading, setPricesLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let active = true;
    setPricesLoading(true);
    void fetch("/api/stripe/coach-platform/plans", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : { prices: {} })
      .then((data) => {
        if (active) setPrices(data.prices ?? {});
      })
      .catch(() => {
        if (active) setPrices({});
      })
      .finally(() => {
        if (active) setPricesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-comparison-title"
        className="flex max-h-[min(860px,calc(100vh-1.5rem))] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/[0.10] bg-[#151515] shadow-2xl shadow-black/60 sm:max-h-[calc(100vh-3rem)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-5 border-b border-white/[0.07] px-5 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Comparer les accès</p>
            <h2 id="plan-comparison-title" className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
              Comparez les formules en un coup d’œil
            </h2>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-white/50">
              Retrouvez ce qui est inclus dans chaque formule. Les fonctions marquées « Bientôt » seront ajoutées ultérieurement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la comparaison des plans"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a65]"
          >
            <X size={17} />
          </button>
        </header>

        <div className="overflow-auto px-5 py-5 sm:px-7">
          <div className="min-w-[710px] overflow-hidden rounded-2xl border border-white/[0.07]">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Comparaison des plans Solo, Pro et Studio</caption>
              <thead className="bg-white/[0.035]">
                <tr>
                  <th scope="col" className="w-[31%] px-4 py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                    Fonctions et limites
                  </th>
                  {PLANS.map((plan) => {
                    const isCurrentPlan = plan === currentPlan;
                    return (
                      <th key={plan} scope="col" className={`w-[23%] border-l border-white/[0.07] px-4 py-4 align-top ${isCurrentPlan ? "bg-[#1f8a65]/[0.08]" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-black text-white">{plan[0].toUpperCase() + plan.slice(1)}</span>
                          {isCurrentPlan ? <span className="rounded-full bg-[#1f8a65] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white">Actuel</span> : null}
                        </div>
                        <p className="mt-1.5 min-h-9 text-[10px] font-medium leading-relaxed text-white/42">{PLAN_DESCRIPTIONS[plan]}</p>
                        <p className="mt-3 text-sm font-black text-white">
                          {pricesLoading ? <Loader2 size={14} className="animate-spin text-white/40" /> : formatPrice(prices[plan])}
                        </p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/[0.07] bg-black/15">
                  <th scope="row" className="px-4 py-3 text-[11px] font-bold text-white/75">Athlètes suivis</th>
                  {PLANS.map((plan) => <td key={plan} className={`border-l border-white/[0.07] px-4 py-3 text-[11px] font-semibold text-white/80 ${plan === currentPlan ? "bg-[#1f8a65]/[0.04]" : ""}`}>{limitLabel(plan)}</td>)}
                </tr>
                {FEATURE_GROUPS.map((group) => (
                  <Fragment key={group.title}>
                    <tr key={group.title} className="border-y border-white/[0.07] bg-white/[0.035]">
                      <th colSpan={4} scope="colgroup" className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
                        {group.title}
                      </th>
                    </tr>
                    {group.features.map((feature) => (
                      <tr key={feature.label} className="border-b border-white/[0.055]">
                        <th scope="row" className="px-4 py-2.5 text-[11px] font-medium text-white/65">
                          <p>{feature.label}</p>
                          <p className="mt-0.5 text-[9px] font-normal leading-relaxed text-white/35">{feature.detail}</p>
                        </th>
                        {PLANS.map((plan) => {
                          const availability = feature.availability[plan];
                          return (
                            <td key={plan} className={`border-l border-white/[0.055] px-4 py-2.5 ${plan === currentPlan ? "bg-[#1f8a65]/[0.04]" : ""}`}>
                              {availability === "included" ? (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#8ef0c7]">
                                  <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                                  <span className="sr-only">Inclus</span>
                                </span>
                              ) : availability === "soon" ? (
                                <span className="inline-flex rounded-full border border-white/[0.12] bg-white/[0.06] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white/60">
                                  Bientôt
                                </span>
                              ) : (
                                <span className="inline-flex text-white/20"><Minus size={13} aria-hidden="true" /><span className="sr-only">Non inclus</span></span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="bg-white/[0.03]">
                <tr>
                  <td className="px-4 py-4 text-[10px] leading-relaxed text-white/38">
                    {!hasConsumedTrial ? "14 jours d’essai inclus sur le premier abonnement." : "Abonnement mensuel."}
                  </td>
                  {PLANS.map((plan) => {
                    const isCurrentPaidPlan = plan === currentPlan && billingStatus !== "inactive";
                    return (
                      <td key={plan} className={`border-l border-white/[0.07] px-4 py-4 ${plan === currentPlan ? "bg-[#1f8a65]/[0.04]" : ""}`}>
                        {isCurrentPaidPlan ? (
                          <span className="flex h-9 items-center justify-center rounded-xl border border-[#69d0ac]/20 bg-[#1f8a65]/10 px-2 text-center text-[10px] font-bold text-[#8ef0c7]">Plan actif</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onChoose(plan)}
                            disabled={choosingPlan !== null}
                            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-2 text-[10px] font-bold text-[#111111] transition-colors hover:bg-white/90 disabled:opacity-40"
                          >
                            {choosingPlan === plan ? <Loader2 size={12} className="animate-spin" /> : null}
                            {plan === currentPlan ? `Activer ${plan}` : `Choisir ${plan}`}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
