'use client'

import { useRef, useState } from 'react'
import { Upload, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Loader2, X, FileText, ArrowRight } from 'lucide-react'
import { TARGET_FIELDS, ColMapping, PreviewRow } from '@/lib/csv-import/detect'

interface Props {
  clientId: string
  onImported?: () => void
  /** When true, renders a small icon button instead of the full banner */
  compact?: boolean
}

type Step = 'idle' | 'mapping' | 'importing' | 'done'

interface ParseResult {
  columns: string[]
  mappings: ColMapping[]
  preview: PreviewRow[]
  totalRows: number
  dateColumnIndex: number | null
}

interface ImportResult {
  inserted: number
  skipped: number
  total: number
  message: string
}

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  TARGET_FIELDS.map(f => [f.key, `${f.label}${f.unit ? ` (${f.unit})` : ''}`])
)

export default function CsvImportButton({ clientId, onImported, compact = false }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [mappings, setMappings] = useState<ColMapping[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)

  function reset() {
    setStep('idle')
    setFile(null)
    setParseResult(null)
    setMappings([])
    setImportResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    setParsing(true)

    const formData = new FormData()
    formData.append('file', f)

    try {
      const res = await fetch(`/api/clients/${clientId}/parse-csv`, {
        method: 'POST',
        body: formData,
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? 'Erreur de lecture du fichier')
        setParsing(false)
        return
      }
      setParseResult(d)
      setMappings(d.mappings)
      setStep('mapping')
    } catch {
      setError('Erreur réseau')
    } finally {
      setParsing(false)
    }
  }

  function updateMapping(csvColumn: string, fieldKey: string | null) {
    setMappings(prev =>
      prev.map(m => m.csvColumn === csvColumn ? { ...m, fieldKey } : m)
    )
  }

  async function handleImport() {
    if (!file || !parseResult) return
    setStep('importing')
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('mappings', JSON.stringify(mappings))

    try {
      const res = await fetch(`/api/clients/${clientId}/import-csv`, {
        method: 'POST',
        body: formData,
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? 'Erreur lors de l\'import')
        setStep('mapping')
      } else {
        setImportResult(d)
        setStep('done')
        onImported?.()
      }
    } catch {
      setError('Erreur réseau')
      setStep('mapping')
    }
  }

  const activeMappings = mappings.filter(m => m.fieldKey !== null)
  const usedFieldKeys = new Set(activeMappings.map(m => m.fieldKey))

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (step === 'idle') {
    if (compact) {
      return (
        <>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-btn bg-surface text-xs font-bold text-secondary hover:text-primary disabled:opacity-50 transition-colors"
          >
            {parsing ? <><Loader2 size={12} className="animate-spin" />Lecture…</> : <><Upload size={12} />Import CSV</>}
          </button>
        </>
      )
    }
    return (
      <div className="bg-surface rounded-card p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-widget bg-surface-light flex items-center justify-center shrink-0">
            <Upload size={15} className="text-secondary" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary">Import CSV — Mesures corporelles</p>
            <p className="text-xs text-secondary">Importez vos données depuis n'importe quel tableur ou logiciel de composition corporelle</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
              <AlertCircle size={13} />{error}
            </div>
          )}
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            className="flex items-center gap-2 px-4 py-2 rounded-btn bg-accent text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow"
          >
            {parsing
              ? <><Loader2 size={13} className="animate-spin" />Lecture…</>
              : <><Upload size={13} />Importer un CSV</>
            }
          </button>
        </div>
      </div>
    )
  }

  // ── MAPPING ───────────────────────────────────────────────────────────────
  if (step === 'mapping' && parseResult) {
    return (
      <div className="bg-surface rounded-card overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText size={15} className="text-accent" />
            <div>
              <p className="text-sm font-bold text-primary">Mapping des colonnes</p>
              <p className="text-[11px] text-secondary mt-0.5">
                Fichier : <span className="font-medium">{file?.name}</span> · {parseResult.totalRows} ligne{parseResult.totalRows !== 1 ? 's' : ''} détectée{parseResult.totalRows !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={reset} className="text-secondary hover:text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Mapping table */}
        <div className="px-5 py-4">
          <p className="text-[11px] text-secondary mb-3">
            Associez chaque colonne de votre fichier à un champ STRYVR. Les colonnes non mappées seront ignorées.
          </p>
          {parseResult.dateColumnIndex === null && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-btn bg-amber-50 border border-amber-200">
              <AlertCircle size={13} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-700">
                Aucune colonne de date détectée — les mesures seront importées avec la date du jour.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {mappings.map(m => (
              <div key={m.csvColumn} className="flex items-center gap-3">
                {/* CSV column name */}
                <div className="w-40 shrink-0">
                  <p className="text-xs font-mono font-bold text-primary truncate" title={m.csvColumn}>
                    {m.csvColumn}
                  </p>
                  {m.confidence >= 70 && m.fieldKey && (
                    <p className="text-[9px] text-green-600 font-medium">Détecté auto</p>
                  )}
                  {m.confidence >= 20 && m.confidence < 70 && m.fieldKey && (
                    <p className="text-[9px] text-amber-500 font-medium">Suggestion</p>
                  )}
                </div>
                <ArrowRight size={12} className="text-secondary/40 shrink-0" />
                {/* Target field select */}
                <select
                  value={m.fieldKey ?? ''}
                  onChange={e => updateMapping(m.csvColumn, e.target.value || null)}
                  className="flex-1 px-3 py-1.5 bg-surface-light rounded-btn text-xs text-primary outline-none focus:ring-2 focus:ring-accent/40"
                >
                  <option value="">— Ignorer cette colonne —</option>
                  {TARGET_FIELDS.map(f => (
                    <option
                      key={f.key}
                      value={f.key}
                      disabled={usedFieldKeys.has(f.key) && m.fieldKey !== f.key}
                    >
                      {f.label}{f.unit ? ` (${f.unit})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        {parseResult.preview.length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-2">
              Aperçu — {Math.min(5, parseResult.preview.length)} premières lignes
            </p>
            <div className="overflow-x-auto rounded-btn border border-white/40">
              <table className="text-[10px] w-full">
                <thead>
                  <tr className="bg-surface-light border-b border-white/40">
                    <th className="px-3 py-2 text-left font-bold text-secondary">Date</th>
                    {activeMappings.map(m => (
                      <th key={m.csvColumn} className="px-3 py-2 text-left font-bold text-secondary whitespace-nowrap">
                        {FIELD_LABEL[m.fieldKey!] ?? m.fieldKey}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.preview.map((row, i) => (
                    <tr key={i} className="border-b border-white/20 last:border-0">
                      <td className="px-3 py-2 font-mono text-secondary">{row.date ?? '—'}</td>
                      {activeMappings.map(m => (
                        <td key={m.csvColumn} className="px-3 py-2 font-mono text-primary">
                          {row.values[m.fieldKey!] != null ? row.values[m.fieldKey!] : <span className="text-secondary/40">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <div className="px-5 pb-3 flex items-center gap-1.5 text-xs text-red-500 font-medium">
            <AlertCircle size={13} />{error}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/40 flex items-center justify-between">
          <button onClick={reset} className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition-colors font-medium">
            <ChevronLeft size={13} />Annuler
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-secondary">
              {activeMappings.length} colonne{activeMappings.length !== 1 ? 's' : ''} mappée{activeMappings.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleImport}
              disabled={activeMappings.length === 0 || parseResult.totalRows === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-btn bg-accent text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow"
            >
              Importer {parseResult.totalRows} ligne{parseResult.totalRows !== 1 ? 's' : ''}
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── IMPORTING ─────────────────────────────────────────────────────────────
  if (step === 'importing') {
    return (
      <div className="bg-surface rounded-card p-8 flex flex-col items-center gap-3">
        <Loader2 size={24} className="text-accent animate-spin" />
        <p className="text-sm font-bold text-primary">Import en cours…</p>
        <p className="text-xs text-secondary">Insertion des mesures dans la base de données</p>
      </div>
    )
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === 'done' && importResult) {
    return (
      <div className="bg-surface rounded-card p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-widget bg-green-50 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary">Import terminé</p>
            <p className="text-xs text-secondary mt-0.5">{importResult.message}</p>
          </div>
        </div>
        <button
          onClick={reset}
          className="text-xs text-secondary hover:text-primary font-medium transition-colors"
        >
          Nouvel import
        </button>
      </div>
    )
  }

  return null
}
