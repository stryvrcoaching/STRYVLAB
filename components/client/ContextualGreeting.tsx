'use client'

import { useEffect, useState } from 'react'
import { useClientT } from './ClientI18nProvider'
import type { ClientDictKey } from '@/lib/i18n/clientTranslations'

interface Props {
  firstName: string
  hasSessionToday: boolean
}

export default function ContextualGreeting({ firstName, hasSessionToday }: Props) {
  const { t } = useClientT()
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    let key: ClientDictKey
    if (hasSessionToday) {
      key = hour < 12 ? 'greeting.session.morning'
          : hour < 18 ? 'greeting.session.afternoon'
          : 'greeting.session.evening'
    } else {
      key = hour < 12 ? 'greeting.rest.morning'
          : hour < 18 ? 'greeting.rest.afternoon'
          : 'greeting.rest.evening'
    }
    setGreeting(t(key, { name: firstName }))
  }, [firstName, hasSessionToday, t])

  if (!greeting) return null

  return (
    <p className="text-[15px] font-semibold text-white leading-snug">{greeting}</p>
  )
}
