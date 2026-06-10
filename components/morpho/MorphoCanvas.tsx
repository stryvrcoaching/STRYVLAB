'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X, Save, Undo2, Redo2, ZoomIn, ZoomOut, Download, Dna,
  MousePointer2, Minus, Pencil, Square, Circle, Type, Eraser,
  Palette, SlidersHorizontal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MorphoPhoto, MorphoAnalysisResult } from '@/lib/morpho/types'
import { MorphoAnalysisPanel } from './MorphoAnalysisPanel'

type Tool = 'select' | 'line' | 'freepath' | 'rect' | 'circle' | 'text' | 'eraser'

interface Props {
  photo: MorphoPhoto
  clientId: string
  onClose: () => void
}

const TOOL_CURSOR: Record<Tool, string> = {
  select: 'default',
  line: 'crosshair',
  freepath: 'crosshair',
  rect: 'crosshair',
  circle: 'crosshair',
  text: 'text',
  eraser: 'cell',
}

const TOOLS: Array<{ id: Tool; Icon: LucideIcon; label: string; hint: string; key: string }> = [
  { id: 'select',   Icon: MousePointer2, label: 'Sélection',  hint: 'Sélectionner et déplacer des éléments', key: 'V' },
  { id: 'line',     Icon: Minus,         label: 'Ligne',      hint: 'Tracer une ligne droite avec angle (vs sol)', key: 'L' },
  { id: 'freepath', Icon: Pencil,        label: 'Crayon',     hint: 'Dessin libre à main levée', key: 'P' },
  { id: 'rect',     Icon: Square,        label: 'Rectangle',  hint: 'Tracer un rectangle', key: 'R' },
  { id: 'circle',   Icon: Circle,        label: 'Cercle',     hint: 'Tracer un cercle', key: 'C' },
  { id: 'text',     Icon: Type,          label: 'Texte',      hint: 'Ajouter une annotation texte', key: 'T' },
  { id: 'eraser',   Icon: Eraser,        label: 'Gomme',      hint: 'Cliquer un élément pour le supprimer', key: 'E' },
]

const KEY_TO_TOOL: Record<string, Tool> = {
  v: 'select', l: 'line', p: 'freepath', r: 'rect', c: 'circle', t: 'text', e: 'eraser',
}

const DOT_SPACING = 24
const DOT_COLOR = 'rgba(255,255,255,0.12)'
const DOT_RADIUS = 1

function drawDotGrid(canvas: HTMLCanvasElement, panX: number, panY: number, zoom: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#0d0d0d'
  ctx.fillRect(0, 0, w, h)

  const spacing = DOT_SPACING * zoom
  const offsetX = ((panX % spacing) + spacing) % spacing
  const offsetY = ((panY % spacing) + spacing) % spacing

  ctx.fillStyle = DOT_COLOR
  for (let x = offsetX; x < w; x += spacing) {
    for (let y = offsetY; y < h; y += spacing) {
      ctx.beginPath()
      ctx.arc(x, y, DOT_RADIUS * Math.min(zoom, 1.5), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

const ANGLE_PRECISION = 10
const ANGLE_LABEL_OFFSET_X = 6
const ANGLE_LABEL_OFFSET_Y = 16

// Angle vs horizontale (sol). 0 = parfaitement horizontal. Plage [-90, 90].
function angleFromHorizontal(x1: number, y1: number, x2: number, y2: number): number {
  const rad = Math.atan2(-(y2 - y1), x2 - x1) // -y : repère écran inversé
  let deg = (rad * 180) / Math.PI
  if (deg > 90) deg -= 180
  if (deg < -90) deg += 180
  const rounded = Math.round(deg * ANGLE_PRECISION) / ANGLE_PRECISION
  return Object.is(rounded, -0) ? 0 : rounded
}

function angleLabel(deg: number): string {
  const formatted = Number.isInteger(deg) ? String(deg) : deg.toFixed(1).replace(/\.0$/, '')
  return `${deg > 0 ? '+' : ''}${formatted}°`
}

function angleLabelPosition(x1: number, y1: number, x2: number, y2: number) {
  if (x1 <= x2) {
    return { left: x1 - ANGLE_LABEL_OFFSET_X, top: y1 - ANGLE_LABEL_OFFSET_Y }
  }
  return { left: x2 - ANGLE_LABEL_OFFSET_X, top: y2 - ANGLE_LABEL_OFFSET_Y }
}

export function MorphoCanvas({ photo, clientId, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fabricModRef = useRef<any>(null) // module fabric (classes)

  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [color, setColor] = useState('#1f8a65')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [zoomPct, setZoomPct] = useState(100)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<MorphoAnalysisResult | null>(null)
  const [stimulusAdjustments, setStimulusAdjustments] = useState<Record<string, number> | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyRef = useRef<any[]>([])
  const historyIndexRef = useRef(-1)
  const isRestoringRef = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawingShapeRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const angleTextRef = useRef<any>(null)
  const isDrawingShapeRef = useRef(false)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)

  const panRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const spaceDownRef = useRef(false)

  const activeToolRef = useRef<Tool>('select')
  const colorRef = useRef(color)
  const strokeWidthRef = useRef(strokeWidth)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { strokeWidthRef.current = strokeWidth }, [strokeWidth])

  const redrawBg = useCallback(() => {
    if (!bgCanvasRef.current) return
    drawDotGrid(bgCanvasRef.current, panRef.current.x, panRef.current.y, zoomRef.current)
  }, [])

  // ── History (guarded against restore re-entrancy) ──
  const saveHistorySnapshot = useCallback(() => {
    const fc = fabricRef.current
    if (!fc || isRestoringRef.current) return
    const json = fc.toJSON(['isBackground'])
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(json)
    historyIndexRef.current = historyRef.current.length - 1
  }, [])

  const applyToolStateToObjects = useCallback(() => {
    const fc = fabricRef.current
    if (!fc) return
    const isDrawTool = activeToolRef.current !== 'select'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fc.getObjects().forEach((obj: any) => {
      if (!obj.isBackground) {
        obj.selectable = !isDrawTool
        obj.evented = !isDrawTool
      }
    })
  }, [])

  const restoreFromHistory = useCallback(() => {
    const fc = fabricRef.current
    if (!fc) return
    isRestoringRef.current = true
    fc.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
      applyToolStateToObjects()
      fc.renderAll()
      isRestoringRef.current = false
    })
  }, [applyToolStateToObjects])

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current--
    restoreFromHistory()
  }, [restoreFromHistory])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current++
    restoreFromHistory()
  }, [restoreFromHistory])

  // ── Background grid sizing ──
  useEffect(() => {
    const container = containerRef.current
    const bg = bgCanvasRef.current
    if (!container || !bg) return
    const resize = () => {
      bg.width = container.clientWidth
      bg.height = container.clientHeight
      redrawBg()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [redrawBg])

  // ── Init Fabric ──
  useEffect(() => {
    if (!fabricCanvasRef.current || !(photo.full_url ?? photo.signed_url)) return
    const container = containerRef.current
    if (!container) return

    let destroyed = false

    import('fabric').then((mod) => {
      const { Canvas, FabricImage, Line, Rect, Circle: FabricCircle, IText, Point, PencilBrush, Group, FabricText } = mod
      if (destroyed || !fabricCanvasRef.current) return
      fabricModRef.current = mod

      const w = container.clientWidth
      const h = container.clientHeight

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fc: any = new Canvas(fabricCanvasRef.current, {
        backgroundColor: 'transparent',
        width: w,
        height: h,
        selection: false,
        preserveObjectStacking: true,
      })
      fabricRef.current = fc

      // Brush (was missing → crayon ne dessinait rien)
      const brush = new PencilBrush(fc)
      brush.color = colorRef.current
      brush.width = strokeWidthRef.current
      fc.freeDrawingBrush = brush

      FabricImage.fromURL((photo.full_url ?? photo.signed_url)!, { crossOrigin: 'anonymous' }).then((img) => {
        if (destroyed) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fabricImg = img as any
        const scaleX = (w * 0.7) / fabricImg.width
        const scaleY = (h * 0.85) / fabricImg.height
        const scale = Math.min(scaleX, scaleY)
        fabricImg.set({
          scaleX: scale, scaleY: scale,
          left: (w - fabricImg.width * scale) / 2,
          top: (h - fabricImg.height * scale) / 2,
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
        })
        fabricImg.isBackground = true
        fc.add(fabricImg)
        fc.sendObjectToBack(fabricImg)
        fc.renderAll()
        historyRef.current = []
        historyIndexRef.current = -1
        saveHistorySnapshot()
      })

      fc.on('after:render', () => {
        const vpt = fc.viewportTransform
        if (vpt) {
          panRef.current = { x: vpt[4], y: vpt[5] }
          zoomRef.current = fc.getZoom()
          redrawBg()
        }
      })

      // ── Shape drawing ──
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on('mouse:down', (opt: any) => {
        // Pan (space held or middle mouse)
        if (spaceDownRef.current || opt.e.button === 1) {
          fc._isPanningCanvas = true
          fc._lastPan = { x: opt.e.clientX, y: opt.e.clientY }
          fc.setCursor('grabbing')
          return
        }

        const tool = activeToolRef.current
        if (tool === 'select' || tool === 'freepath' || tool === 'text') return

        if (tool === 'eraser') {
          const target = fc.findTarget(opt.e)
          if (target && !(target as { isBackground?: boolean }).isBackground) {
            fc.remove(target)
            fc.renderAll()
            saveHistorySnapshot()
          }
          return
        }

        const pointer = fc.getScenePoint(opt.e)
        startPointRef.current = { x: pointer.x, y: pointer.y }
        isDrawingShapeRef.current = true

        if (tool === 'line') {
          const shape = new Line(
            [pointer.x, pointer.y, pointer.x, pointer.y],
            { stroke: colorRef.current, strokeWidth: strokeWidthRef.current, selectable: false, evented: false }
          )
          drawingShapeRef.current = shape
          fc.add(shape)
          const txt = new FabricText('0°', {
            left: pointer.x - ANGLE_LABEL_OFFSET_X,
            top: pointer.y - ANGLE_LABEL_OFFSET_Y,
            fontSize: 11,
            fontWeight: 'normal',
            fill: colorRef.current,
            fontFamily: 'sans-serif',
            selectable: false,
            evented: false,
          })
          angleTextRef.current = txt
          fc.add(txt)
        } else if (tool === 'rect') {
          const shape = new Rect({
            left: pointer.x, top: pointer.y, width: 0, height: 0,
            fill: 'transparent', stroke: colorRef.current, strokeWidth: strokeWidthRef.current,
            selectable: false, evented: false,
          })
          drawingShapeRef.current = shape
          fc.add(shape)
        } else if (tool === 'circle') {
          const shape = new FabricCircle({
            left: pointer.x, top: pointer.y, radius: 1,
            fill: 'transparent', stroke: colorRef.current, strokeWidth: strokeWidthRef.current,
            selectable: false, evented: false,
          })
          drawingShapeRef.current = shape
          fc.add(shape)
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fc.on('mouse:move', (opt: any) => {
        // Pan
        if (fc._isPanningCanvas) {
          const dx = opt.e.clientX - fc._lastPan.x
          const dy = opt.e.clientY - fc._lastPan.y
          fc._lastPan = { x: opt.e.clientX, y: opt.e.clientY }
          const vpt = fc.viewportTransform
          vpt[4] += dx
          vpt[5] += dy
          fc.requestRenderAll()
          return
        }

        if (!isDrawingShapeRef.current || !startPointRef.current || !drawingShapeRef.current) return
        const pointer = fc.getScenePoint(opt.e)
        const { x: sx, y: sy } = startPointRef.current
        const tool = activeToolRef.current

        if (tool === 'line') {
          drawingShapeRef.current.set({ x2: pointer.x, y2: pointer.y })
          if (angleTextRef.current) {
            const deg = angleFromHorizontal(sx, sy, pointer.x, pointer.y)
            const position = angleLabelPosition(sx, sy, pointer.x, pointer.y)
            angleTextRef.current.set({ text: angleLabel(deg), ...position })
          }
        } else if (tool === 'rect') {
          drawingShapeRef.current.set({
            left: Math.min(pointer.x, sx), top: Math.min(pointer.y, sy),
            width: Math.abs(pointer.x - sx), height: Math.abs(pointer.y - sy),
          })
        } else if (tool === 'circle') {
          const radius = Math.max(1, Math.sqrt((pointer.x - sx) ** 2 + (pointer.y - sy) ** 2) / 2)
          drawingShapeRef.current.set({
            left: Math.min(pointer.x, sx), top: Math.min(pointer.y, sy), radius,
          })
        }
        fc.renderAll()
      })

      fc.on('mouse:up', () => {
        if (fc._isPanningCanvas) {
          fc._isPanningCanvas = false
          fc.setCursor(TOOL_CURSOR[activeToolRef.current])
          return
        }
        if (!isDrawingShapeRef.current || !drawingShapeRef.current) return
        isDrawingShapeRef.current = false
        const tool = activeToolRef.current

        if (tool === 'line' && angleTextRef.current) {
          // Grouper ligne + label angle → déplaçables ensemble
          const line = drawingShapeRef.current
          const txt = angleTextRef.current
          fc.remove(line)
          fc.remove(txt)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const group: any = new Group([line, txt], { selectable: true, evented: true })
          group.isAnnotation = true
          fc.add(group)
          angleTextRef.current = null
        } else {
          drawingShapeRef.current.set({ selectable: true, evented: true })
        }
        drawingShapeRef.current = null
        startPointRef.current = null
        fc.renderAll()
        saveHistorySnapshot()
      })

      // Freepath persistence
      fc.on('path:created', () => { saveHistorySnapshot() })

      // Native wheel (passive:false) → zoom to pointer, blocks browser/pinch zoom
      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        const fcc = fabricRef.current
        if (!fcc) return
        let zoom = fcc.getZoom()
        zoom *= 0.999 ** e.deltaY
        zoom = Math.min(Math.max(zoom, 0.2), 5)
        const rect = container.getBoundingClientRect()
        fcc.zoomToPoint(new Point(e.clientX - rect.left, e.clientY - rect.top), zoom)
        setZoomPct(Math.round(zoom * 100))
      }
      container.addEventListener('wheel', onWheel, { passive: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(fc as any)._onWheelCleanup = () => container.removeEventListener('wheel', onWheel)
    })

    return () => {
      destroyed = true
      const fc = fabricRef.current
      if (fc) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((fc as any)._onWheelCleanup) (fc as any)._onWheelCleanup()
        fc.dispose()
        fabricRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.full_url ?? photo.signed_url])

  // ── Sync tool/color/stroke ──
  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return
    fc.isDrawingMode = activeTool === 'freepath'
    if (fc.freeDrawingBrush) {
      fc.freeDrawingBrush.color = color
      fc.freeDrawingBrush.width = strokeWidth
    }
    fc.selection = activeTool === 'select'
    fc.defaultCursor = TOOL_CURSOR[activeTool]
    applyToolStateToObjects()
    fc.renderAll()
  }, [activeTool, color, strokeWidth, applyToolStateToObjects])

  const addText = useCallback(() => {
    const mod = fabricModRef.current
    const fc = fabricRef.current
    if (!mod || !fc) return
    const { IText } = mod
    const cx = (fc.width ?? 400) / 2
    const cy = (fc.height ?? 300) / 2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text: any = new IText('Annotation', {
      left: cx - 50, top: cy - 10,
      fill: colorRef.current, fontSize: 18, fontFamily: 'sans-serif',
    })
    text.isAnnotation = true
    fc.add(text)
    fc.setActiveObject(text)
    setActiveTool('select')
    saveHistorySnapshot()
  }, [saveHistorySnapshot])

  useEffect(() => {
    if (activeTool === 'text') addText()
  }, [activeTool, addText])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const fc = fabricRef.current
      // Ignore while typing in inputs or editing IText
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (fc?.getActiveObject?.()?.isEditing) return

      const mod = e.metaKey || e.ctrlKey

      if (e.code === 'Space') { spaceDownRef.current = true; if (fc) fc.defaultCursor = 'grab'; return }

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo(); else undo()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && fc) {
        const active = fc.getActiveObject()
        if (active && !active.isBackground) {
          e.preventDefault()
          fc.remove(active)
          fc.discardActiveObject()
          fc.renderAll()
          saveHistorySnapshot()
        }
        return
      }
      // Tool shortcuts (no modifier)
      if (!mod && !e.altKey) {
        const tool = KEY_TO_TOOL[e.key.toLowerCase()]
        if (tool) { e.preventDefault(); setActiveTool(tool) }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false
        const fc = fabricRef.current
        if (fc) fc.defaultCursor = TOOL_CURSOR[activeToolRef.current]
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [undo, redo, saveHistorySnapshot])

  function handleZoom(factor: number) {
    const fc = fabricRef.current
    const mod = fabricModRef.current
    if (!fc || !mod) return
    const zoom = Math.min(Math.max(fc.getZoom() * factor, 0.2), 5)
    fc.zoomToPoint(new mod.Point((fc.width ?? 0) / 2, (fc.height ?? 0) / 2), zoom)
    setZoomPct(Math.round(zoom * 100))
  }

  function resetView() {
    const fc = fabricRef.current
    if (!fc) return
    fc.setViewportTransform([1, 0, 0, 1, 0, 0])
    setZoomPct(100)
    fc.renderAll()
  }

  async function handleSave() {
    const fc = fabricRef.current
    if (!fc) return
    setSaving(true)
    setError(null)
    try {
      const canvasData = fc.toJSON(['isBackground'])
      const thumbnailBase64 = fc.toDataURL({ format: 'png', multiplier: 0.3 })
      const res = await fetch('/api/morpho/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.id, canvasData, thumbnailBase64 }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erreur sauvegarde')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/morpho/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: [photo.id], clientId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur analyse')
      } else {
        setAnalysisResult(data.analysis_result)
        setStimulusAdjustments(data.stimulus_adjustments)
        setShowAnalysis(true)
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setAnalyzing(false)
    }
  }

  function handleExportPNG() {
    const fc = fabricRef.current
    if (!fc) return
    const url = fc.toDataURL({ format: 'png', multiplier: 1 })
    const a = document.createElement('a')
    a.href = url
    a.download = `morpho-${photo.position}-${photo.taken_at}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: '#0d0d0d' }}>
      {/* Toolbar gauche */}
      <div className="w-[76px] bg-[#181818] border-r-[0.3px] border-white/[0.06] flex flex-col items-center py-3 gap-0.5 shrink-0 z-10 overflow-y-auto">
        <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-white/20 mb-1.5">Outils</p>
        {TOOLS.map(({ id, Icon, label, hint, key }) => (
          <div key={id} className="relative">
            <button
              onClick={() => setActiveTool(id)}
              onMouseEnter={() => setTooltip(id)}
              onMouseLeave={() => setTooltip(null)}
              className={`w-16 h-11 rounded-lg flex items-center justify-center gap-1.5 px-2 transition-all ${
                activeTool === id
                  ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
                  : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70'
              }`}
            >
              <Icon size={15} />
              <span className="text-[8px] font-medium leading-tight flex-1 text-left">{label}</span>
              <kbd className={`text-[8px] font-mono px-1 py-0.5 rounded ${
                activeTool === id ? 'bg-[#1f8a65]/20 text-[#1f8a65]' : 'bg-white/[0.06] text-white/35'
              }`}>{key}</kbd>
            </button>
            {tooltip === id && (
              <div className="absolute left-[72px] top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                <div className="bg-[#0f0f0f] border-[0.3px] border-white/[0.06] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl">
                  <p className="text-[11px] font-semibold text-white/80">{label} <span className="text-white/30">· {key}</span></p>
                  <p className="text-[10px] text-white/40 mt-0.5 max-w-[160px] leading-relaxed whitespace-normal">{hint}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="w-12 h-px bg-white/[0.06] my-2" />

        {/* Couleur */}
        <div className="relative">
          <div className="w-16 h-10 rounded-lg flex items-center justify-center gap-1.5 px-2 text-white/40 hover:text-white/70 cursor-pointer">
            <Palette size={15} />
            <span className="text-[8px] font-medium flex-1 text-left">Couleur</span>
            <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: color }} />
          </div>
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>

        {/* Épaisseur */}
        <div className="flex flex-col items-center gap-1 mt-2 w-full px-1">
          <div className="flex items-center gap-1 text-white/30">
            <SlidersHorizontal size={11} />
            <span className="text-[8px] font-medium">Épaisseur</span>
          </div>
          <div className="flex items-center justify-center gap-0.5 flex-wrap mt-1">
            {[1, 2, 4, 7, 10].map(w => (
              <button
                key={w}
                onClick={() => setStrokeWidth(w)}
                title={`${w}px`}
                className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
                  strokeWidth === w ? 'bg-[#1f8a65]/20' : 'hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: Math.min(w * 2.2, 18),
                    height: Math.max(1, w * 0.7),
                    backgroundColor: strokeWidth === w ? '#1f8a65' : 'rgba(255,255,255,0.25)',
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas zone */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 bg-[#181818] border-b-[0.3px] border-white/[0.06] flex items-center px-4 gap-3 shrink-0 z-10">
          <button onClick={undo} className="p-1.5 text-white/40 hover:text-white/70 transition-colors" title="Annuler (⌘Z)">
            <Undo2 size={14} />
          </button>
          <button onClick={redo} className="p-1.5 text-white/40 hover:text-white/70 transition-colors" title="Rétablir (⌘⇧Z)">
            <Redo2 size={14} />
          </button>
          <div className="w-px h-4 bg-white/[0.06]" />
          <button onClick={() => handleZoom(0.8)} className="p-1.5 text-white/40 hover:text-white/70 transition-colors" title="Zoom arrière">
            <ZoomOut size={14} />
          </button>
          <button onClick={resetView} className="text-[10px] font-mono text-white/40 hover:text-white/70 w-10 text-center transition-colors" title="Réinitialiser la vue">
            {zoomPct}%
          </button>
          <button onClick={() => handleZoom(1.25)} className="p-1.5 text-white/40 hover:text-white/70 transition-colors" title="Zoom avant">
            <ZoomIn size={14} />
          </button>
          <span className="text-[9px] text-white/20 font-mono hidden md:inline">scroll/pinch = zoom · espace+glisser = déplacer</span>
          <div className="flex-1" />
          {error && <p className="text-[10px] text-red-400">{error}</p>}
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-[#1f8a65]/10 text-[#1f8a65] text-[10px] font-bold hover:bg-[#1f8a65]/20 disabled:opacity-50 transition-all"
          >
            <Dna size={11} className={analyzing ? 'animate-pulse' : ''} />
            {analyzing ? 'Analyse…' : 'Analyser IA'}
          </button>
          <button onClick={handleExportPNG} className="p-1.5 text-white/40 hover:text-white/70 transition-colors" title="Exporter PNG">
            <Download size={14} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-[#1f8a65] text-white text-[10px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-all"
          >
            <Save size={11} />
            {saving ? '…' : 'Sauvegarder'}
          </button>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white/70 ml-2 transition-colors" title="Fermer">
            <X size={16} />
          </button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ cursor: TOOL_CURSOR[activeTool] }}>
          <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />
          <canvas ref={fabricCanvasRef} className="absolute inset-0" />
        </div>
      </div>

      {/* Panel IA latéral */}
      {showAnalysis && analysisResult && (
        <div className="w-72 bg-[#181818] border-l-[0.3px] border-white/[0.06] overflow-y-auto p-4 shrink-0 z-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Analyse IA</p>
            <button onClick={() => setShowAnalysis(false)} className="text-white/30 hover:text-white/60">
              <X size={13} />
            </button>
          </div>
          <MorphoAnalysisPanel
            result={analysisResult}
            stimulusAdjustments={stimulusAdjustments}
            clientId={clientId}
          />
        </div>
      )}
    </div>
  )
}
