'use client'

import { createContext, useContext, useState } from 'react'

interface TourContextValue {
  highlightedNavIndex: number | null
  setHighlightedNavIndex: (index: number | null) => void
  highlightFAB: boolean
  setHighlightFAB: (v: boolean) => void
}

const TourContext = createContext<TourContextValue>({
  highlightedNavIndex: null,
  setHighlightedNavIndex: () => {},
  highlightFAB: false,
  setHighlightFAB: () => {},
})

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [highlightedNavIndex, setHighlightedNavIndex] = useState<number | null>(null)
  const [highlightFAB, setHighlightFAB] = useState(false)
  return (
    <TourContext.Provider value={{ highlightedNavIndex, setHighlightedNavIndex, highlightFAB, setHighlightFAB }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  return useContext(TourContext)
}
