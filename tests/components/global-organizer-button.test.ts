import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import GlobalOrganizerButton from '@/components/layout/GlobalOrganizerButton'

describe('GlobalOrganizerButton', () => {
  it('renders the compact header trigger', () => {
    const html = renderToStaticMarkup(React.createElement(GlobalOrganizerButton))

    expect(html).toContain('aria-label="Organiser"')
    expect(html).toContain('h-8')
    expect(html).toContain('w-8')
  })

  it('opens with both mode active by default', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialClients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/coach/clients',
      }),
    )

    expect(html).toContain('Créer une action coach')
    expect(html).toContain('Les deux')
    expect(html).toContain('border-[#1f8a65]/70')
  })

  it('renders kanban targeting and explicit alert controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialClients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/coach/clients',
      }),
    )

    expect(html).toContain('Cible kanban')
    expect(html).toContain('Activer une alerte')
    expect(html).toContain('Importance')
  })

  it('renders a disabled submit CTA until a client is selected', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialClients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/coach/clients',
      }),
    )

    expect(html).toContain('Créer l&#x27;action')
    expect(html).toContain('disabled=""')
  })

  it('renders the smart presets block', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialClients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/coach/clients/client-1/protocoles/nutrition',
      }),
    )

    expect(html).toContain('Presets smart')
    expect(html).toContain('Suivi nutrition')
    expect(html).toContain('Relance formule')
    expect(html).toContain('Point check-in')
    expect(html).toContain('Bilan à traiter')
  })

  it('promotes the route-matched preset as recommended', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialClients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/dashboard',
      }),
    )

    expect(html).toContain('Recommandé')
    expect(html.indexOf('Point check-in')).toBeLessThan(html.indexOf('Relance formule'))
  })

  it('renders contextual help copy for the current page', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialClients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/coach/clients/client-1/protocoles/nutrition',
      }),
    )

    expect(html).toContain('Organisation nutrition')
    expect(html).toContain('l&#x27;outil sert surtout à programmer un suivi nutrition')
  })

  it('renders the help modal content when opened', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialHelpOpen: true,
        initialClients: [{ id: 'client-1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/coach/clients/client-1/protocoles/nutrition',
      }),
    )

    expect(html).toContain('Informations sur l&#x27;organisation')
    expect(html).toContain('Comment utiliser l&#x27;organisation ici')
    expect(html).toContain('Le client courant est détecté automatiquement')
  })

  it('preselects the current client when the page carries a client context', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialClients: [{ id: 'client-1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/coach/clients/client-1/protocoles/nutrition',
      }),
    )

    expect(html).toContain('value="client-1"')
    expect(html).toContain('Lina Moreau')
    expect(html).toContain('Suivi nutrition')
  })

  it('uses bilan-specific contextual copy and preset ordering', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialHelpOpen: true,
        initialClients: [{ id: 'client-1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/coach/clients/client-1/data/bilans',
      }),
    )

    expect(html).toContain('Organisation bilan')
    expect(html).toContain('Bilan à traiter')
    expect(html).toContain('Depuis les bilans, cet outil te sert à ne pas laisser une analyse sans suite concrète')
  })

  it('uses performance-specific contextual copy and preset ordering', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialHelpOpen: true,
        initialClients: [{ id: 'client-1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/coach/clients/client-1/data/performances',
      }),
    )

    expect(html).toContain('Organisation performance')
    expect(html).toContain('Point progression')
    expect(html).toContain('Depuis les performances, cet outil te sert à programmer une lecture coach claire')
  })

  it('uses workout-specific contextual copy and preset ordering', () => {
    const html = renderToStaticMarkup(
      React.createElement(GlobalOrganizerButton, {
        initialOpen: true,
        initialHelpOpen: true,
        initialClients: [{ id: 'client-1', first_name: 'Lina', last_name: 'Moreau' }],
        initialPathname: '/coach/clients/client-1/protocoles/entrainement',
      }),
    )

    expect(html).toContain('Organisation entraînement')
    expect(html).toContain('Ajustement entraînement')
    expect(html).toContain('Depuis Workout Studio, cet outil te sert à transformer une décision sur l&#x27;entraînement en action concrète')
  })
})
