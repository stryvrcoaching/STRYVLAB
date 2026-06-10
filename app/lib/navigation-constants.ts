// Shared navigation constants
export type NavigationItem = {
  label: string
  href: string
  hasDropdown?: boolean
}

export const navigationItems: NavigationItem[] = [
  { label: 'Accueil', href: '/' },
  { label: 'Analyse IPT', href: '/ipt-choice' },
  { label: 'Outils', href: '/outils', hasDropdown: true },
  { label: 'FAQ', href: '/#faq' }
]

