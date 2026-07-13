export type LandingV2Event =
  | "hero_cta"
  | "demo_cta"
  | "studio_select"
  | "intelligence_focus"
  | "faq_open"
  | "final_cta"
  | "nav_select";
export function trackLandingV2Event(
  _event: LandingV2Event,
  _properties: Record<string, string> = {},
) {
  /* local no-op: reserved for existing analytics integration */
}
