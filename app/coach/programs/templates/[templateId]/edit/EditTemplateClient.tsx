'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import ProgramTemplateBuilder from '@/components/programs/ProgramTemplateBuilder'

interface Props {
  template: any
  templateId: string
}

export default function EditTemplateClient({ template, templateId }: Props) {
  const router = useRouter()

  const topBarLeft = useMemo(() => (
    <div className="flex items-center gap-3 min-w-0">
      <button
        onClick={() => router.push('/coach/programs/templates')}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-all"
      >
        <ChevronLeft size={14} />
      </button>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Templates</p>
        <p className="text-[13px] font-semibold text-white leading-none truncate">
          {template?.name ?? 'Modifier le template'}
        </p>
      </div>
    </div>
  ), [router, template?.name])

  return (
    <div className="h-full bg-[#121212] font-sans">
      <ProgramTemplateBuilder
        initial={template}
        templateId={templateId}
        topBarLeft={topBarLeft}
      />
    </div>
  )
}
