import DocsIndexPage from '@/components/docs/DocsIndexPage'
import { getDocsForAudience } from '@/lib/docs/registry'
import { requireCoachDocsAccess } from '@/lib/docs/server'

export default async function CoachDocumentationIndexPage() {
  await requireCoachDocsAccess()

  return (
    <DocsIndexPage
      audience="coach"
      title="Comprendre les outils d’aide à la décision"
      intro="Cette documentation explique, en langage naturel, le rôle de chaque outil, les données utilisées, la façon correcte de lire les résultats et comment améliorer la qualité des signaux pour obtenir des décisions plus fiables."
      docs={getDocsForAudience('coach')}
    />
  )
}
