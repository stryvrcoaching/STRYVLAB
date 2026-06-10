'use client'

import { useRef, useState, useCallback } from 'react'

export type ScrubberState = {
  activeIndex: number | null
}

export type ScrubberHandlers = {
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void
  onPointerLeave: () => void
  onTouchMove: (e: React.TouchEvent<SVGSVGElement>) => void
  onTouchEnd: () => void
}

export function useChartScrubber(pointCount: number, svgWidth: number, padLeft: number, padRight: number): {
  activeIndex: number | null
  handlers: ScrubberHandlers
  svgRef: React.RefObject<SVGSVGElement>
} {
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const getIndexFromClientX = useCallback((clientX: number) => {
    if (!svgRef.current || pointCount < 2) return null
    const rect = svgRef.current.getBoundingClientRect()
    const innerW = svgWidth - padLeft - padRight
    // Map clientX to SVG coordinate space
    const svgX = ((clientX - rect.left) / rect.width) * svgWidth
    const ratio = Math.max(0, Math.min(1, (svgX - padLeft) / innerW))
    return Math.round(ratio * (pointCount - 1))
  }, [pointCount, svgWidth, padLeft, padRight])

  const handlers: ScrubberHandlers = {
    onPointerMove: useCallback((e: React.PointerEvent<SVGSVGElement>) => {
      const idx = getIndexFromClientX(e.clientX)
      if (idx !== null) setActiveIndex(idx)
    }, [getIndexFromClientX]),

    onPointerLeave: useCallback(() => {
      setActiveIndex(null)
    }, []),

    onTouchMove: useCallback((e: React.TouchEvent<SVGSVGElement>) => {
      e.preventDefault()
      const touch = e.touches[0]
      if (!touch) return
      const idx = getIndexFromClientX(touch.clientX)
      if (idx !== null) setActiveIndex(idx)
    }, [getIndexFromClientX]),

    onTouchEnd: useCallback(() => {
      setActiveIndex(null)
    }, []),
  }

  return { activeIndex, handlers, svgRef }
}
