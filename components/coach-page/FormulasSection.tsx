import { Check } from "lucide-react";
import type { FormulasContent, PublicFormula } from "@/types/coach-page";
import { resolveSectionPresentation } from "@/types/coach-page";
import { trackCoachPageEvent } from "./CoachPageTracker";
import { AccentButton, SectionShell } from "./section-primitives";

interface Props {
  content: FormulasContent;
  formulas: PublicFormula[];
  accentColor: string;
  slug?: string;
  /**
   * Force single-column stack (used by builder mobile preview — Tailwind
   * breakpoints follow the browser viewport, not the phone frame width).
   */
  forceStack?: boolean;
}

const BILLING_LABELS: Record<string, string> = {
  one_time: "paiement unique",
  weekly: "/ sem.",
  monthly: "/ mois",
  quarterly: "/ trim.",
  yearly: "/ an",
};

const MAX_FEATURES_MOBILE = 4;

function FormulaCard({
  formula,
  accentColor,
  ctaLabel,
  ctaUrl,
  featured,
  slug,
}: {
  formula: PublicFormula;
  accentColor: string;
  ctaLabel: string;
  ctaUrl?: string;
  featured?: boolean;
  slug?: string;
}) {
  const features = formula.features ?? [];
  const visibleFeatures = features.slice(0, MAX_FEATURES_MOBILE);
  const extraCount = Math.max(0, features.length - MAX_FEATURES_MOBILE);

  return (
    <article
      className="flex min-h-0 h-full w-full flex-col rounded-2xl border p-5 sm:p-6"
      style={{
        borderColor: featured
          ? `color-mix(in srgb, ${accentColor} 50%, transparent)`
          : "var(--cp-border)",
        backgroundColor: featured
          ? `color-mix(in srgb, ${accentColor} 9%, var(--cp-bg))`
          : "var(--cp-surface-2)",
        boxShadow: featured
          ? `0 0 0 1px color-mix(in srgb, ${accentColor} 18%, transparent)`
          : undefined,
      }}
    >
      {/* Top row: name + badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-[color:var(--cp-text)] sm:text-base">
          {formula.name}
        </h3>
        {featured && (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
            style={{
              backgroundColor: `${accentColor}20`,
              color: accentColor,
            }}
          >
            Phare
          </span>
        )}
      </div>

      {/* Price block — more compact on mobile */}
      <div className="mt-3 flex flex-wrap items-end gap-x-1.5 gap-y-0.5 sm:mt-4">
        <span
          className="text-[26px] font-semibold tabular-nums leading-none tracking-tight sm:text-[28px]"
          style={{ color: accentColor }}
        >
          {formula.price_eur === 0
            ? "Sur devis"
            : `${formula.price_eur.toFixed(0)}\u00A0€`}
        </span>
        {formula.price_eur > 0 && (
          <span className="pb-0.5 text-[11px] text-[color:var(--cp-text-faint)] sm:text-xs">
            {BILLING_LABELS[formula.billing_cycle] ?? ""}
          </span>
        )}
      </div>

      {formula.duration_months ? (
        <p className="mt-1.5 text-[11px] text-[color:var(--cp-text-faint)]">
          Engagement {formula.duration_months} mois
        </p>
      ) : null}

      {formula.description ? (
        <p className="mt-3 line-clamp-3 text-[13px] leading-5 text-[color:var(--cp-text-muted)] text-pretty sm:mt-4 sm:line-clamp-none sm:text-sm sm:leading-6">
          {formula.description}
        </p>
      ) : null}

      {visibleFeatures.length > 0 && (
        <ul className="mt-4 space-y-2 sm:mt-5 sm:space-y-2.5">
          {visibleFeatures.map((feature) => (
            <li
              className="flex items-start gap-2 text-[13px] leading-snug text-[color:var(--cp-text-muted)] sm:gap-2.5 sm:text-sm"
              key={feature}
            >
              <Check
                aria-hidden="true"
                className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                style={{ color: accentColor }}
                strokeWidth={2.4}
              />
              <span className="text-pretty">{feature}</span>
            </li>
          ))}
          {extraCount > 0 && (
            <li className="pl-[22px] text-[12px] font-medium text-[color:var(--cp-text-faint)] sm:hidden">
              +{extraCount} inclus
            </li>
          )}
          {/* Desktop: show remaining features */}
          {extraCount > 0 &&
            features.slice(MAX_FEATURES_MOBILE).map((feature) => (
              <li
                className="hidden items-start gap-2.5 text-sm text-[color:var(--cp-text-muted)] sm:flex"
                key={`d-${feature}`}
              >
                <Check
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: accentColor }}
                  strokeWidth={2.2}
                />
                <span className="text-pretty">{feature}</span>
              </li>
            ))}
        </ul>
      )}

      <div className="mt-auto pt-5 sm:pt-6">
        <AccentButton
          className="w-full !min-h-11 text-[13px] sm:!min-h-12 sm:text-sm"
          external={Boolean(ctaUrl && !ctaUrl.startsWith("#"))}
          href={ctaUrl || "#contact"}
          onClick={() =>
            slug &&
            trackCoachPageEvent(slug, "formula_click", {
              formula: formula.name,
            })
          }
        >
          {ctaLabel}
        </AccentButton>
      </div>
    </article>
  );
}

export function FormulasSection({
  content,
  formulas,
  accentColor,
  slug,
  forceStack = false,
}: Props) {
  // Explicit selection → those IDs. Else prefer show_on_page, else all provided.
  const displayFormulas = (() => {
    if (content.formula_ids && content.formula_ids.length > 0) {
      const selected = formulas.filter((f) =>
        content.formula_ids!.includes(f.id),
      );
      return selected.length > 0 ? selected : formulas;
    }
    const flagged = formulas.filter((f) => f.show_on_page);
    return flagged.length > 0 ? flagged : formulas;
  })();

  if (displayFormulas.length === 0) return null;

  const ctaLabel = content.cta_label || "Me contacter";
  const ctaUrl = content.cta_url;
  const count = displayFormulas.length;

  // Always one-per-row on phone / mobile preview. Multi-column only from md+.
  const gridClass = forceStack
    ? "flex w-full flex-col gap-3"
    : count === 1
      ? "mx-auto flex w-full max-w-md flex-col gap-3 md:gap-4"
      : count === 2
        ? "mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-2 md:gap-4"
        : "grid w-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3";

  return (
    <SectionShell
      id="formules"
      presentation={resolveSectionPresentation("formulas", content.presentation)}
      wide={!forceStack && count >= 3}
    >
      <div className={gridClass}>
        {displayFormulas.map((formula, index) => (
          <FormulaCard
            accentColor={accentColor}
            ctaLabel={ctaLabel}
            ctaUrl={ctaUrl}
            featured={count > 1 && index === 0}
            formula={formula}
            key={formula.id}
            slug={slug}
          />
        ))}
      </div>
    </SectionShell>
  );
}
