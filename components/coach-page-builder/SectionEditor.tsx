"use client";

import type {
  BuilderSection,
  SectionType,
  PublicFormula,
  HeroContent,
  AboutContent,
  FormulasContent,
  GalleryContent,
  TestimonialsContent,
  ContactContent,
  CustomSectionsContent,
} from "@/types/coach-page";
import { SECTION_META } from "@/types/coach-page";
import { HeroEditor } from "./SectionEditors/HeroEditor";
import { AboutEditor } from "./SectionEditors/AboutEditor";
import { FormulasEditor } from "./SectionEditors/FormulasEditor";
import { GalleryEditor } from "./SectionEditors/GalleryEditor";
import { TestimonialsEditor } from "./SectionEditors/TestimonialsEditor";
import { ContactEditor } from "./SectionEditors/ContactEditor";
import { CustomSectionsEditor } from "./SectionEditors/CustomSectionsEditor";
import { cn } from "@/lib/utils";

interface Props {
  type: SectionType;
  section: BuilderSection;
  coachId: string;
  formulas: PublicFormula[];
  /** brand_name || full_name — used as default for hero display name */
  profileDefaultName?: string;
  onChange: (content: BuilderSection["content"]) => void;
  onSave: (content?: BuilderSection["content"]) => Promise<void>;
  isSaving: boolean;
}

export function SectionEditor({
  type,
  section,
  coachId,
  formulas,
  profileDefaultName,
  onChange,
  onSave,
  isSaving,
}: Props) {
  const meta = SECTION_META[type];

  const renderEditor = () => {
    switch (type) {
      case "hero":
        return (
          <HeroEditor
            content={section.content as HeroContent}
            coachId={coachId}
            profileDefaultName={profileDefaultName}
            onChange={onChange}
            onSave={async (heroContent) => {
              await onSave(heroContent);
            }}
          />
        );
      case "about":
        return (
          <AboutEditor
            content={section.content as AboutContent}
            coachId={coachId}
            onChange={onChange}
            onSave={async (aboutContent) => {
              await onSave(aboutContent);
            }}
          />
        );
      case "formulas":
        return (
          <FormulasEditor
            content={section.content as FormulasContent}
            formulas={formulas}
            onChange={onChange}
            onEnsureVisible={(formulaId) => {
              void fetch(`/api/formulas/${formulaId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ show_on_page: true }),
              });
            }}
          />
        );
      case "gallery":
        return (
          <GalleryEditor
            content={section.content as GalleryContent}
            coachId={coachId}
            onChange={onChange}
            onSave={async (galleryContent) => {
              await onSave(galleryContent);
            }}
          />
        );
      case "testimonials":
        return (
          <TestimonialsEditor
            content={section.content as TestimonialsContent}
            onChange={onChange}
          />
        );
      case "contact":
        return (
          <ContactEditor
            content={section.content as ContactContent}
            onChange={onChange}
          />
        );
      case "custom":
        return (
          <CustomSectionsEditor
            content={section.content as CustomSectionsContent}
            coachId={coachId}
            onChange={onChange}
            onSave={async (customContent) => {
              await onSave(customContent);
            }}
          />
        );
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5 sm:gap-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold leading-none tracking-[-0.01em] text-white text-balance">
            {meta.label}
          </h2>
          <p className="mt-1.5 line-clamp-2 max-w-prose text-[12px] leading-snug text-white/45 text-pretty">
            {meta.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={isSaving}
          aria-busy={isSaving}
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#1f8a65] px-4 text-[13px] font-semibold text-white",
            "transition-[background-color,transform,opacity] duration-150",
            "hover:bg-[#217356] active:scale-[0.96]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a65]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]",
            "disabled:cursor-wait disabled:opacity-55 disabled:active:scale-100",
          )}
        >
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </header>

      {/* pb clears the floating coach NavDock when scrolling to the end */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 pb-[calc(138px+24px)] sm:px-6 sm:py-6 sm:pb-[calc(138px+24px)]">
        {renderEditor()}
      </div>
    </div>
  );
}
