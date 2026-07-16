'use client'

import { createContext, useContext, useState } from 'react'

interface TourContextValue {
  highlightedNavIndex: number | null
  setHighlightedNavIndex: (index: number | null) => void
  highlightFAB: boolean
  setHighlightFAB: (v: boolean) => void
  status: 'checking' | 'active' | 'complete'
  setStatus: (status: 'checking' | 'active' | 'complete') => void
}

const TourContext = createContext<TourContextValue>({
  highlightedNavIndex: null,
  setHighlightedNavIndex: () => {},
  highlightFAB: false,
  setHighlightFAB: () => {},
  status: 'checking',
  setStatus: () => {},
})

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [highlightedNavIndex, setHighlightedNavIndex] = useState<number | null>(null)
  const [highlightFAB, setHighlightFAB] = useState(false)
  const [status, setStatus] = useState<'checking' | 'active' | 'complete'>('checking')
  return (
    <TourContext.Provider value={{ highlightedNavIndex, setHighlightedNavIndex, highlightFAB, setHighlightFAB, status, setStatus }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  return useContext(TourContext)
}
