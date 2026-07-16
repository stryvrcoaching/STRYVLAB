import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, BookOpen } from 'lucide-react'

export function DocsArticle({
  eyebrow,
  title,
  intro,
  backHref,
  backLabel,
  children,
}: {
  eyebrow: string
  title: string
  intro: string
  backHref: string
  backLabel: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/80"
        >
          <ArrowLeft size={13} />
          <span>{backLabel}</span>
        </Link>
      </div>

      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
        <div className="mb-8 rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(31,138,101,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            <BookOpen size={12} />
            <span>{eyebrow}</span>
          </div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/62">
            {intro}
          </p>
        </div>

        <div className="space-y-8">{children}</div>
      </div>
    </div>
  )
}

export function DocsSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white/88">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-white/62">{children}</div>
    </section>
  )
}

export function DocsCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white/80">{title}</h3>
      <div className="mt-2 space-y-2 text-sm leading-6 text-white/58">{children}</div>
    </div>
  )
}
