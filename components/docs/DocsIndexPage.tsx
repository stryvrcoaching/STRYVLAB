'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BookOpen, Search, Tag, X } from 'lucide-react'
import {
  DOCS_CONTEXT_META,
  DOCS_CATEGORY_META,
  type DocsAudience,
  type DocsCategory,
  type DocsEntry,
  groupDocsByCategory,
} from '@/lib/docs/registry'

export default function DocsIndexPage({
  audience,
  title,
  intro,
  docs,
}: {
  audience: DocsAudience
  title: string
  intro: string
  docs: DocsEntry[]
}) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<DocsCategory | null>(null)
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)

  const availableCategories = useMemo(() => {
    const categories = new Set<DocsCategory>()
    docs.forEach((doc) => doc.categories.forEach((category) => categories.add(category)))
    return Array.from(categories).sort(
      (left, right) => DOCS_CATEGORY_META[left].order - DOCS_CATEGORY_META[right].order,
    )
  }, [docs])

  const availableKeywords = useMemo(() => {
    const keywords = new Map<string, number>()
    docs.forEach((doc) => {
      doc.keywords.forEach((keyword) => {
        keywords.set(keyword, (keywords.get(keyword) ?? 0) + 1)
      })
    })
    return Array.from(keywords.entries())
      .sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1]
        return left[0].localeCompare(right[0], 'fr')
      })
      .map(([keyword]) => keyword)
  }, [docs])

  const filteredDocs = useMemo(() => {
    const query = search.trim().toLowerCase()
    return docs.filter((doc) => {
      const matchCategory = !selectedCategory || doc.categories.includes(selectedCategory)
      const matchKeyword = !selectedKeyword || doc.keywords.includes(selectedKeyword)
      const haystack = [
        doc.title,
        doc.summary,
        ...doc.keywords,
        ...doc.categories.map((category) => DOCS_CATEGORY_META[category].label),
        ...doc.contexts.map((context) => DOCS_CONTEXT_META[context].label),
      ]
        .join(' ')
        .toLowerCase()

      const matchSearch = !query || haystack.includes(query)
      return matchCategory && matchKeyword && matchSearch
    })
  }, [docs, search, selectedCategory, selectedKeyword])

  const grouped = useMemo(() => groupDocsByCategory(filteredDocs), [filteredDocs])
  const featured = useMemo(
    () => filteredDocs.filter((doc) => doc.featured),
    [filteredDocs],
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
        <div className="mb-8 rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(31,138,101,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            <BookOpen size={12} />
            <span>{audience === 'coach' ? 'Documentation coach' : 'Documentation client'}</span>
          </div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/62">
            {intro}
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 rounded-xl bg-[#0f0f0f] px-3">
            <Search size={15} className="text-white/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une documentation, un concept, un mot-clé"
              className="h-12 w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/25"
            />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Catégories</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={selectedCategory === null}
                onClick={() => setSelectedCategory(null)}
                label="Toutes"
              />
              {availableCategories.map((category) => (
                <FilterChip
                  key={category}
                  active={selectedCategory === category}
                  onClick={() => setSelectedCategory(category)}
                  label={DOCS_CATEGORY_META[category].label}
                />
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Mots-clés</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={selectedKeyword === null}
                onClick={() => setSelectedKeyword(null)}
                label="Tous"
              />
              {availableKeywords.map((keyword) => (
                <FilterChip
                  key={keyword}
                  active={selectedKeyword === keyword}
                  onClick={() => setSelectedKeyword(keyword)}
                  label={keyword}
                />
              ))}
            </div>
          </div>

          {(search || selectedCategory || selectedKeyword) && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[12px] text-white/55">
                {filteredDocs.length} documentation{filteredDocs.length > 1 ? 's' : ''} trouvée{filteredDocs.length > 1 ? 's' : ''}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setSelectedCategory(null)
                  setSelectedKeyword(null)
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-white/60 hover:bg-white/[0.07] hover:text-white/85"
              >
                <X size={12} />
                Réinitialiser
              </button>
            </div>
          )}
        </div>

        {featured.length > 0 && !search && !selectedCategory && !selectedKeyword && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-white/88">À la une</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {featured.map((doc) => (
                <DocIndexCard key={doc.id} doc={doc} />
              ))}
            </div>
          </section>
        )}

        {grouped.length > 0 ? (
          <div className="space-y-10">
            {grouped.map((group) => (
              <section key={group.category}>
                <div className="mb-4 flex items-center gap-2">
                  <Tag size={14} className="text-white/35" />
                  <h2 className="text-lg font-semibold text-white/88">{group.label}</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {group.docs.map((doc) => (
                    <DocIndexCard key={`${group.category}-${doc.id}`} doc={doc} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-8 text-center">
            <p className="text-[15px] font-semibold text-white/80">Aucune documentation trouvée</p>
            <p className="mt-2 text-[13px] leading-6 text-white/48">
              Essaie un autre mot-clé, enlève un filtre ou reviens à toutes les catégories.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
        active
          ? 'bg-[#1f8a65]/15 text-[#7fe2bf]'
          : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.07] hover:text-white/78'
      }`}
    >
      {label}
    </button>
  )
}

function DocIndexCard({ doc }: { doc: DocsEntry }) {
  return (
    <Link
      href={doc.route}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.05]"
    >
      <div className="flex flex-wrap gap-2">
        {doc.contexts.map((context) => (
          <span
            key={context}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45"
          >
            {DOCS_CONTEXT_META[context].label}
          </span>
        ))}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white/86">{doc.title}</h2>
      <p className="mt-2 text-sm leading-7 text-white/58">
        {doc.summary}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {doc.keywords.map((keyword) => (
          <span
            key={keyword}
            className="rounded-full bg-[#1f8a65]/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7fe2bf]"
          >
            {keyword}
          </span>
        ))}
      </div>
    </Link>
  )
}
