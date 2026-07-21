import type {
  BuilderSection,
  ContactContent,
  HeroContent,
  PublicFormula,
  SectionType,
} from "@/types/coach-page";

export type ReadinessItem = {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
};

export function getPublishReadiness(
  sections: BuilderSection[],
  formulas: PublicFormula[],
  profile: { full_name?: string | null; brand_name?: string | null },
): ReadinessItem[] {
  const byType = Object.fromEntries(
    sections.map((s) => [s.type, s]),
  ) as Partial<Record<SectionType, BuilderSection>>;

  const hero = byType.hero;
  const heroContent = (hero?.content ?? {}) as HeroContent;
  const contact = byType.contact;
  const contactContent = (contact?.content ?? {}) as ContactContent;
  const hasName = Boolean(
    heroContent.display_name?.trim() ||
      profile.brand_name?.trim() ||
      profile.full_name?.trim(),
  );
  const hasPhoto = Boolean(heroContent.profile_photo_url);
  const hasTagline = Boolean(heroContent.tagline?.trim());
  const hasContact = Boolean(
    contact?.is_enabled &&
      (contactContent.cal_url ||
        contactContent.email ||
        contactContent.whatsapp ||
        contactContent.instagram),
  );
  const visibleFormulas = formulas.filter((f) => f.show_on_page);
  const formulasEnabled = byType.formulas?.is_enabled;
  const hasFormulas =
    Boolean(formulasEnabled) && visibleFormulas.length > 0;

  return [
    {
      id: "name",
      label: "Nom principal (accueil) ou marque / profil Pro",
      done: hasName,
      required: true,
    },
    {
      id: "photo",
      label: "Photo de profil dans l’accueil",
      done: hasPhoto,
      required: true,
    },
    {
      id: "tagline",
      label: "Accroche (tagline) renseignée",
      done: hasTagline,
      required: true,
    },
    {
      id: "contact",
      label: "Au moins un moyen de contact actif",
      done: hasContact,
      required: true,
    },
    {
      id: "formulas",
      label: "Formules visibles (recommandé)",
      done: hasFormulas,
      required: false,
    },
  ];
}

export function canPublish(items: ReadinessItem[]): boolean {
  return items.filter((i) => i.required).every((i) => i.done);
}
