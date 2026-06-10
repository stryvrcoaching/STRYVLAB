'use client'

import { useState, useRef } from 'react'
import { X, Upload } from 'lucide-react'
import { POSITION_LABELS, type MorphoPhotoPosition } from '@/lib/morpho/types'

interface Props {
  clientId: string
  onClose: () => void
  onUploaded: () => void
}

const POSITIONS: MorphoPhotoPosition[] = ['front', 'back', 'left', 'right', 'three_quarter_front_left', 'three_quarter_front_right', 'relaxed', 'contracted']

// Compresse une image côté client : max 2000px sur le grand côté, JPEG q=0.85.
// Évite l'erreur "body exceeds 4.5MB" de Vercel sur photos haute résolution.
async function compressImage(file: File): Promise<Blob> {
  const MAX_DIM = 2000
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  let { width, height } = img
  if (width > MAX_DIM || height > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, width, height)
  return new Promise<Blob>(resolve => {
    canvas.toBlob(b => resolve(b ?? file), 'image/jpeg', 0.85)
  })
}

export function MorphoUploadModal({ clientId, onClose, onUploaded }: Props) {
  const [position, setPosition] = useState<MorphoPhotoPosition>('front')
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Format non supporté (jpeg, png, webp)')
      return
    }
    setFile(f)
    setError(null)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function handleSubmit() {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const compressed = await compressImage(file)
      const form = new FormData()
      form.append('clientId', clientId)
      form.append('position', position)
      form.append('takenAt', takenAt)
      form.append('notes', notes)
      // Toujours .jpg après compression
      form.append('file', compressed, file.name.replace(/\.[^.]+$/, '') + '.jpg')

      const res = await fetch('/api/morpho/photos/upload', { method: 'POST', body: form })
      if (!res.ok) {
        let msg = 'Erreur upload'
        try { msg = (await res.json()).error ?? msg } catch { msg = `Erreur serveur (${res.status})` }
        setError(msg)
      } else {
        onUploaded()
        onClose()
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] rounded-2xl p-6 w-full max-w-md border-[0.3px] border-white/[0.06] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-[14px]">Ajouter une photo</h3>
          <button onClick={onClose} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Zone drag & drop */}
        <div
          className={`border-[0.3px] border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-all ${
            preview ? 'border-[#1f8a65]/40' : 'border-white/[0.12] hover:border-white/25'
          }`}
          style={{ minHeight: 160 }}
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onDragOver={e => e.preventDefault()}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className="max-h-40 rounded-lg object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-8">
              <Upload size={24} className="text-white/20" />
              <p className="text-[11px] text-white/30">Glisser-déposer ou cliquer pour sélectionner</p>
              <p className="text-[10px] text-white/20">JPEG, PNG, WebP</p>
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>

        {/* Position */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Position</label>
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map(p => (
              <button
                key={p}
                onClick={() => setPosition(p)}
                className={`px-2.5 h-7 rounded-lg text-[10px] font-semibold transition-all ${
                  position === p ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/50 hover:text-white/70'
                }`}
              >
                {POSITION_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Date de la photo</label>
          <input
            type="date"
            value={takenAt}
            onChange={e => setTakenAt(e.target.value)}
            className="w-full rounded-xl bg-[#0a0a0a] px-4 h-[44px] text-[13px] text-white outline-none border-[0.3px] border-white/[0.06]"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Notes (optionnel)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: après 3 mois de programme"
            className="w-full rounded-xl bg-[#0a0a0a] px-4 h-[44px] text-[13px] text-white placeholder:text-white/20 outline-none border-[0.3px] border-white/[0.06]"
          />
        </div>

        {error && <p className="text-[11px] text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="flex-1 py-2.5 rounded-xl bg-[#1f8a65] text-white text-[13px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Upload…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
