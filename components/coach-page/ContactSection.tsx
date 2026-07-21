import { ArrowUpRight, Calendar, Instagram, Mail, MessageCircle } from "lucide-react";
import type { ContactContent } from "@/types/coach-page";
import { resolveSectionPresentation } from "@/types/coach-page";
import { toWhatsAppHref } from "@/lib/coach-page/whatsapp";
import { trackCoachPageEvent } from "./CoachPageTracker";
import { AccentButton, GhostButton, SectionShell } from "./section-primitives";

interface Props {
  content: ContactContent;
  slug?: string;
}

type ContactLink = {
  href: string;
  label: string;
  kind: "primary" | "secondary";
  icon: typeof Calendar;
};

export function ContactSection({ content, slug }: Props) {
  const links: ContactLink[] = [];

  if (content.cal_url) {
    links.push({
      href: content.cal_url,
      label: content.custom_cta_label || "Réserver un appel",
      kind: "primary",
      icon: Calendar,
    });
  }
  const whatsappHref = toWhatsAppHref(content.whatsapp);
  if (whatsappHref) {
    links.push({
      href: whatsappHref,
      label: "WhatsApp",
      kind: content.cal_url ? "secondary" : "primary",
      icon: MessageCircle,
    });
  }
  if (content.email) {
    links.push({
      href: `mailto:${content.email}`,
      label: content.email,
      kind: links.some((l) => l.kind === "primary") ? "secondary" : "primary",
      icon: Mail,
    });
  }
  if (content.instagram) {
    const handle = content.instagram.startsWith("@")
      ? content.instagram.slice(1)
      : content.instagram;
    links.push({
      href: `https://instagram.com/${handle}`,
      label: `@${handle}`,
      kind: "secondary",
      icon: Instagram,
    });
  }

  if (links.length === 0) return null;

  const primary = links.find((l) => l.kind === "primary") ?? links[0];
  const secondary = links.filter((l) => l !== primary);
  const PrimaryIcon = primary.icon;

  return (
    <SectionShell
      id="contact"
      narrow
      presentation={resolveSectionPresentation("contact", content.presentation)}
    >
      <div className="flex w-full flex-col items-stretch gap-2.5 sm:items-center sm:gap-3">
        <AccentButton
          className="w-full sm:w-auto sm:min-w-[220px]"
          external
          href={primary.href}
          onClick={() =>
            slug &&
            trackCoachPageEvent(slug, "cta_click", { source: "contact" })
          }
        >
          <span className="inline-flex items-center justify-center gap-2">
            <PrimaryIcon aria-hidden="true" className="h-4 w-4" />
            <span className="truncate">{primary.label}</span>
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 opacity-80" />
          </span>
        </AccentButton>

        {secondary.length > 0 && (
          <div className="mt-1 flex w-full flex-col gap-2 sm:mt-2 sm:flex-row sm:flex-wrap sm:justify-center">
            {secondary.map((link) => {
              const Icon = link.icon;
              return (
                <GhostButton
                  className="w-full sm:w-auto"
                  external
                  href={link.href}
                  key={link.href}
                  onClick={() =>
                    slug &&
                    trackCoachPageEvent(slug, "cta_click", {
                      source: "contact_secondary",
                    })
                  }
                >
                  <span className="inline-flex max-w-full items-center justify-center gap-2">
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </span>
                </GhostButton>
              );
            })}
          </div>
        )}
      </div>
    </SectionShell>
  );
}
