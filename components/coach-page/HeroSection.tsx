import type { ContactContent, HeroContent } from "@/types/coach-page";
import {
  buildCoverFadeGradient,
  resolveCoverFadeStart,
  resolveCoverOpacity,
  resolveHeroDisplayName,
} from "@/types/coach-page";
import { toWhatsAppHref } from "@/lib/coach-page/whatsapp";
import {
  normalizePhotoFrame,
  photoFrameClasses,
  resolveCoverHeight,
} from "@/lib/coach-page/photo-frame";
import { cn } from "@/lib/utils";
import { trackCoachPageEvent } from "./CoachPageTracker";
import { AccentButton, GhostButton } from "./section-primitives";

interface Props {
  content: HeroContent;
  profile: {
    full_name?: string | null;
    brand_name?: string | null;
    logo_url?: string | null;
  };
  accentColor: string;
  contact?: ContactContent | null;
  slug?: string;
}

function resolvePrimaryCta(contact?: ContactContent | null) {
  if (!contact) return null;
  if (contact.cal_url) {
    return {
      href: contact.cal_url,
      label: contact.custom_cta_label?.trim() || "Réserver un appel",
      external: true,
    };
  }
  const wa = toWhatsAppHref(contact.whatsapp);
  if (wa) {
    return {
      href: wa,
      label: contact.custom_cta_label?.trim() || "Écrire sur WhatsApp",
      external: true,
    };
  }
  if (contact.email) {
    return {
      href: `mailto:${contact.email}`,
      label: contact.custom_cta_label?.trim() || "Envoyer un email",
      external: true,
    };
  }
  return null;
}

export function HeroSection({
  content,
  profile,
  accentColor,
  contact,
  slug,
}: Props) {
  const displayName = resolveHeroDisplayName(content, profile);
  const profilePhoto = content.profile_photo_url ?? profile.logo_url;
  const primaryCta = resolvePrimaryCta(contact);
  const profileFrame = normalizePhotoFrame(content.profile_frame, "rounded");
  const coverHeight = resolveCoverHeight(content.cover_frame);
  const coverOpacity = resolveCoverOpacity(content);
  const coverFadeStart = resolveCoverFadeStart(content);
  const coverFadeGradient = buildCoverFadeGradient(coverFadeStart);
  const showCover =
    Boolean(content.cover_photo_url) && coverHeight > 0;

  return (
    <section
      aria-label="Présentation du coach"
      className="relative overflow-hidden border-b"
      style={{ borderColor: "var(--cp-border)" }}
    >
      {showCover && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: `${coverHeight}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            src={content.cover_photo_url!}
            style={{ opacity: coverOpacity / 100 }}
          />
          {/* Bottom fade — start height is configurable (cover_fade_start) */}
          {coverFadeGradient ? (
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: coverFadeGradient }}
            />
          ) : null}
        </div>
      )}

      <div
        className={cn(
          "relative mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-8 text-center sm:px-6 sm:pb-14 lg:max-w-4xl lg:px-10",
          // Leave enough top space for the cover to read before the profile block
          showCover
            ? "pt-16 sm:pt-20 md:pt-24 lg:pt-28"
            : "pt-14 sm:pt-20 lg:pt-24",
        )}
      >
        {profilePhoto ? (
          <div
            className={cn(
              "relative overflow-hidden border-[0.3px]",
              photoFrameClasses(profileFrame, { size: "lg" }),
            )}
            style={{
              borderColor: "var(--cp-border)",
              backgroundColor: "var(--cp-input)",
              boxShadow: `0 0 0 1px ${accentColor}33`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`Photo de ${displayName}`}
              className="absolute inset-0 h-full w-full object-cover"
              src={profilePhoto}
            />
          </div>
        ) : (
          <div
            aria-hidden="true"
            className={cn(
              "flex items-center justify-center border-[0.3px] text-2xl font-semibold",
              photoFrameClasses(profileFrame, { size: "lg" }),
            )}
            style={{
              borderColor: "var(--cp-border)",
              backgroundColor: "var(--cp-surface)",
              color: "var(--cp-text-faint)",
            }}
          >
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}

        <h1 className="mt-6 max-w-2xl text-[2.15rem] font-semibold leading-[1.05] tracking-[-0.03em] text-[color:var(--cp-text)] text-balance sm:mt-7 sm:text-5xl sm:leading-[1.02]">
          {displayName}
        </h1>

        {content.tagline && (
          <p
            className="mt-3 max-w-xl px-1 text-base font-medium sm:text-lg"
            style={{ color: accentColor }}
          >
            {content.tagline}
          </p>
        )}

        {content.subtitle && (
          <p className="mt-3 max-w-lg px-1 text-[15px] leading-6 text-[color:var(--cp-text-muted)] text-pretty sm:mt-4 sm:text-base sm:leading-7">
            {content.subtitle}
          </p>
        )}

        <div className="mt-8 flex w-full max-w-md flex-col gap-2.5 sm:mt-9 sm:flex-row sm:justify-center">
          {primaryCta ? (
            <AccentButton
              className="w-full sm:w-auto sm:min-w-[180px]"
              external={primaryCta.external}
              href={primaryCta.href}
              onClick={() =>
                slug &&
                trackCoachPageEvent(slug, "cta_click", { source: "hero" })
              }
            >
              {primaryCta.label}
            </AccentButton>
          ) : (
            <AccentButton
              className="w-full sm:w-auto sm:min-w-[180px]"
              href="#contact"
              onClick={() =>
                slug &&
                trackCoachPageEvent(slug, "cta_click", { source: "hero" })
              }
            >
              Me contacter
            </AccentButton>
          )}
          <GhostButton className="w-full sm:w-auto" href="#formules">
            Voir les formules
          </GhostButton>
        </div>
      </div>
    </section>
  );
}
