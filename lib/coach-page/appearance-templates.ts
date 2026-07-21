import type { BgChoice, FontChoice } from "@/types/coach-page";

export type AppearanceTemplate = {
  id: string;
  label: string;
  description: string;
  accent_color: string;
  font_choice: FontChoice;
  bg_choice: BgChoice;
};

export const APPEARANCE_TEMPLATES: AppearanceTemplate[] = [
  {
    id: "stryv",
    label: "STRYV",
    description: "Émeraude Flat Dark — aligné plateforme",
    accent_color: "#1f8a65",
    font_choice: "lufga",
    bg_choice: "dark",
  },
  {
    id: "studio",
    label: "Studio",
    description: "Surface plus claire, accent menthe",
    accent_color: "#2ea87a",
    font_choice: "barlow",
    bg_choice: "charcoal",
  },
  {
    id: "clinical",
    label: "Clinique",
    description: "Contraste net, fond input dark",
    accent_color: "#3d9b8f",
    font_choice: "lufga",
    bg_choice: "slate",
  },
  {
    id: "copper",
    label: "Cuivre",
    description: "Chaleur premium, sport lifestyle",
    accent_color: "#9d7052",
    font_choice: "barlow",
    bg_choice: "dark",
  },
  {
    id: "mono",
    label: "Mono",
    description: "Minimal gris, très discret",
    accent_color: "#8a8a8a",
    font_choice: "lufga",
    bg_choice: "charcoal",
  },
  {
    id: "daylight",
    label: "Clair",
    description: "Fond clair, accent émeraude — mini-site light",
    accent_color: "#1f8a65",
    font_choice: "lufga",
    bg_choice: "light",
  },
  {
    id: "paper",
    label: "Papier",
    description: "Blanc net, lecture confortable",
    accent_color: "#1a7a5c",
    font_choice: "barlow",
    bg_choice: "paper",
  },
];
