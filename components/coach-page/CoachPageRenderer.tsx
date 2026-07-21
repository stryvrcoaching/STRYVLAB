"use client";

import type {
  AboutContent,
  CoachPage,
  CoachPageSection,
  ContactContent,
  CustomSectionsContent,
  FormulasContent,
  GalleryContent,
  HeroContent,
  PublicFormula,
  SectionType,
  TestimonialsContent,
} from "@/types/coach-page";
import { AboutSection } from "./AboutSection";
import { CoachPageThemeProvider } from "./CoachPageThemeProvider";
import { ContactSection } from "./ContactSection";
import { FormulasSection } from "./FormulasSection";
import { GallerySection } from "./GallerySection";
import { HeroSection } from "./HeroSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { CustomSectionsSection } from "./CustomSectionsSection";

export type CoachPageProfile = {
  full_name?: string | null;
  brand_name?: string | null;
  logo_url?: string | null;
};

type SectionLike = Pick<CoachPageSection, "type" | "content" | "is_enabled" | "position"> & {
  is_enabled?: boolean;
  position?: number;
};

interface Props {
  page: Pick<CoachPage, "accent_color" | "font_choice" | "bg_choice">;
  sections: SectionLike[];
  formulas: PublicFormula[];
  profile: CoachPageProfile;
  showFooter?: boolean;
  className?: string;
  /** Public slug — enables click tracking when set */
  slug?: string;
  /** Builder preview: force mobile stacking regardless of viewport breakpoints */
  forceMobileLayout?: boolean;
}

export function CoachPageRenderer({
  page,
  sections,
  formulas,
  profile,
  showFooter = true,
  className,
  slug,
  forceMobileLayout = false,
}: Props) {
  const enabled = [...sections]
    .filter((s) => s.is_enabled !== false)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const contactSection = enabled.find((s) => s.type === "contact");
  const contactContent = contactSection?.content as ContactContent | undefined;
  const renderSection = (type: SectionType, content: SectionLike["content"]) => {
    switch (type) {
      case "hero":
        return (
          <HeroSection
            accentColor={page.accent_color}
            contact={contactContent}
            content={content as HeroContent}
            key="hero"
            profile={profile}
            slug={slug}
          />
        );
      case "about":
        return (
          <AboutSection
            content={content as AboutContent}
            forceStack={forceMobileLayout}
            key="about"
          />
        );
      case "formulas":
        return (
          <FormulasSection
            accentColor={page.accent_color}
            content={content as FormulasContent}
            forceStack={forceMobileLayout}
            formulas={formulas}
            key="formulas"
            slug={slug}
          />
        );
      case "gallery":
        return (
          <GallerySection
            content={content as GalleryContent}
            forceStack={forceMobileLayout}
            key="gallery"
          />
        );
      case "testimonials":
        return (
          <TestimonialsSection
            content={content as TestimonialsContent}
            forceStack={forceMobileLayout}
            key="testimonials"
          />
        );
      case "contact":
        return (
          <ContactSection
            content={content as ContactContent}
            key="contact"
            slug={slug}
          />
        );
      case "custom":
        return (
          <CustomSectionsSection
            content={content as CustomSectionsContent}
            forceStack={forceMobileLayout}
            key="custom"
          />
        );
      default:
        return null;
    }
  };

  return (
    <CoachPageThemeProvider
      accentColor={page.accent_color}
      bgChoice={page.bg_choice}
      className={className}
      fontChoice={page.font_choice}
    >
      <main className="min-h-full">
        {enabled.map((section) =>
          renderSection(section.type as SectionType, section.content),
        )}
      </main>

      {showFooter && (
        <footer
          className="border-t px-4 py-5 text-center sm:px-6 sm:py-6"
          style={{ borderColor: "var(--cp-border)" }}
        >
          <p className="text-xs text-[color:var(--cp-footer)]">
            Propulsé par{" "}
            <a
              className="underline-offset-2 transition-opacity duration-150 hover:opacity-80"
              href="https://stryvlab.com"
              rel="noopener noreferrer"
              style={{ color: "var(--cp-text-muted)" }}
              target="_blank"
            >
              STRYV lab
            </a>
          </p>
        </footer>
      )}
    </CoachPageThemeProvider>
  );
}
