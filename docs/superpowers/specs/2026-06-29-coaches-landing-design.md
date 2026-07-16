# Coaches Landing V1

**Date:** 2026-06-29  
**Status:** Approved  
**Route:** `/coaches`

## Understanding Summary

- A new dedicated landing page must be created separately from the current homepage.
- The page should present the broader STRYV ecosystem, while keeping `STRYV Lab` as the commercial center of gravity.
- The primary CTA is `Demander un accès`.
- The promise combines:
  - structuring coaching into a clearer, more professional system
  - improving personalization, adherence, and client outcomes
- The dominant tone is `Smart coaching`: product-led, modern, systematic, and premium.
- The main proof pillars are:
  - the smart system logic behind the platform
  - concrete coach and client use cases
- The lead capture should happen inside a modal, not inline in the hero.

## Assumptions

- The landing targets coaches and high-touch accompagnants first.
- `STRYVR` must appear as the client-side extension of the system, not as the main product on this page.
- V1 optimizes for qualified interest, not direct payment conversion.
- The existing `beta_waitlist` table can serve as the first lead capture backend.
- Pricing is not the central story on this version.

## Decision Log

1. **Decision:** Create a separate landing route instead of rewriting the homepage.  
   **Alternatives considered:** replace `/`, reuse the current homepage.  
   **Why chosen:** lower risk, faster iteration, cleaner message.

2. **Decision:** Position the page around the full STRYV ecosystem with `STRYV Lab` as the dominant offer.  
   **Alternatives considered:** only `STRYV Lab`, equal weighting between products.  
   **Why chosen:** protects clarity while still showing the broader ambition.

3. **Decision:** Use a modal for the main CTA.  
   **Alternatives considered:** inline form, dedicated form page.  
   **Why chosen:** keeps the hero sharp and reduces visual friction.

4. **Decision:** Use the existing waitlist backend for V1 capture.  
   **Alternatives considered:** new CRM table, richer lead schema.  
   **Why chosen:** operational immediately, minimal backend risk.

5. **Decision:** Use a `Smart Command Center` visual direction.  
   **Alternatives considered:** classic SaaS workflow page, ecosystem showroom page.  
   **Why chosen:** best fit with the `smart coaching` tone and product differentiation.

## Design Direction Summary

- **Aesthetic name:** Smart Command Center
- **DFII score:** 12
- **Inspiration:** control room UI, precision dashboards, editorial product storytelling

### Design System Snapshot

- **Display font:** `Unbounded`
- **Body font:** `Lufga` / project sans stack
- **Dominant color story:** deep graphite + strategic STRYV green
- **Anchor:** the ecosystem is visualized as a live coaching command system rather than as a generic feature list
- **Motion philosophy:** sparse reveal transitions and stateful modal interaction only

## Narrative Structure

1. Hero: STRYV as a smarter coaching operating system
2. Pain break: fragmented coaching versus controlled system
3. Ecosystem architecture: STRYV Lab, smart core, STRYVR
4. Use cases: coach operations, client adherence, smart adaptation
5. Product depth: concrete capability rails
6. Closing CTA with modal capture

## Non-Goals

- No pricing section in V1
- No direct checkout flow
- No attempt to fully replace the current homepage
- No CRM-grade lead enrichment beyond waitlist capture
