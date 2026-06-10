'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  Kanban,
  Trash2,
  X,
  Check,
  Edit3,
  GripVertical,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { KanbanBoard, type KanbanBoard as KanbanBoardType } from '@/components/ui/KanbanBoard'
import { useSetTopBar } from '@/components/layout/useSetTopBar'

function SortableBoardSection({
  board,
  colAdded,
  isDragging,
  onRename,
  onDelete,
  onAddColumn,
}: {
  board: KanbanBoardType
  colAdded: number
  isDragging: boolean
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onAddColumn: (boardId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: board.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(board.title)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const saveTitle = async () => {
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === board.title) { setEditing(false); setTitleDraft(board.title); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/organisation/boards?id=${board.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (res.ok) onRename(board.id, trimmed)
    } catch { /* silent */ }
    finally { setSaving(false); setEditing(false) }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.015] overflow-hidden"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setConfirmDelete(false) }}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab text-white/15 hover:text-white/40 transition-colors active:cursor-grabbing touch-none"
          aria-label="Réorganiser"
        >
          <GripVertical size={15} />
        </button>

        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); saveTitle() }} className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              className="flex-1 min-w-0 rounded-lg bg-[#0a0a0a] px-3 py-1.5 text-[13px] font-bold text-white outline-none"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
            />
            <button type="submit" disabled={saving} className="text-[#1f8a65] hover:text-[#217356] transition-colors">
              <Check size={14} />
            </button>
            <button type="button" onClick={() => { setEditing(false); setTitleDraft(board.title) }} className="text-white/30 hover:text-white/60 transition-colors">
              <X size={14} />
            </button>
          </form>
        ) : (
          <span className="flex-1 text-[13px] font-bold text-white/70 tracking-wide">{board.title}</span>
        )}

        {!editing && (
          <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity duration-150 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
            <button
              type="button"
              onClick={() => { setEditing(true); setTitleDraft(board.title) }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all"
              aria-label="Renommer"
            >
              <Edit3 size={12} />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-[11px] text-white/40">Supprimer ?</span>
                <button type="button" onClick={() => onDelete(board.id)} className="px-2 py-0.5 rounded-md bg-red-500/80 text-[11px] text-white font-semibold hover:bg-red-500 transition-colors">Oui</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[11px] text-white/55 hover:bg-white/[0.10] transition-colors">Non</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/25 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
                aria-label="Supprimer"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        <KanbanBoard
          key={`${board.id}-${colAdded}`}
          boardId={board.id}
          onAddColumnRequest={() => onAddColumn(board.id)}
        />
      </div>
    </div>
  )
}

export default function DashboardKanban() {
  const [boards, setBoards] = useState<KanbanBoardType[]>([])
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [creatingBoard, setCreatingBoard] = useState(false)
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [savingBoard, setSavingBoard] = useState(false)
  const [addColModal, setAddColModal] = useState<{ boardId: string } | null>(null)
  const [newColTitle, setNewColTitle] = useState('')
  const [savingCol, setSavingCol] = useState(false)
  const [colAdded, setColAdded] = useState<Record<string, number>>({})
  const [activeDragBoardId, setActiveDragBoardId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const loadBoards = useCallback(async () => {
    setLoadingBoards(true)
    try {
      const res = await fetch('/api/organisation/boards')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: KanbanBoardType[] = await res.json()
      if (data.length === 0) {
        const created = await fetch('/api/organisation/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Tableau principal' }),
        })
        if (created.ok) setBoards([await created.json()])
      } else {
        setBoards(data)
      }
    } catch (err) { console.error('[DashboardKanban] loadBoards:', err) }
    finally { setLoadingBoards(false) }
  }, [])

  useEffect(() => { loadBoards() }, [loadBoards])

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBoardTitle.trim()) return
    setSavingBoard(true)
    try {
      const res = await fetch('/api/organisation/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newBoardTitle.trim() }),
      })
      if (!res.ok) return
      const board = await res.json()
      setBoards(prev => [...prev, { ...board, order: prev.length }])
      setCreatingBoard(false)
      setNewBoardTitle('')
    } catch { /* silent */ }
    finally { setSavingBoard(false) }
  }

  const handleDeleteBoard = async (id: string) => {
    if (boards.length <= 1) return
    const res = await fetch(`/api/organisation/boards?id=${id}`, { method: 'DELETE' })
    if (res.ok) setBoards(prev => prev.filter(b => b.id !== id))
  }

  const handleRenameBoard = (id: string, title: string) => {
    setBoards(prev => prev.map(b => b.id === id ? { ...b, title } : b))
  }

  const handleBoardDragStart = (event: DragStartEvent) => {
    setActiveDragBoardId(String(event.active.id))
  }

  const handleBoardDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragBoardId(null)
    if (!over || active.id === over.id) return
    const oldIdx = boards.findIndex(b => b.id === active.id)
    const newIdx = boards.findIndex(b => b.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(boards, oldIdx, newIdx)
    setBoards(reordered)
    await Promise.all(
      reordered.map((board, index) =>
        fetch(`/api/organisation/boards?id=${board.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: index }),
        })
      )
    )
  }

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newColTitle.trim() || !addColModal) return
    setSavingCol(true)
    try {
      const res = await fetch('/api/organisation/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board_id: addColModal.boardId, title: newColTitle.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      setColAdded(prev => ({ ...prev, [addColModal.boardId]: (prev[addColModal.boardId] ?? 0) + 1 }))
      setAddColModal(null)
      setNewColTitle('')
    } catch { /* silent */ }
    finally { setSavingCol(false) }
  }

  useSetTopBar(null, undefined)

  const activeDragBoard = boards.find(b => b.id === activeDragBoardId)

  return (
    <div>
      {loadingBoards ? (
        <div className="space-y-6">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.015] overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
                <div className="h-3 w-32 rounded-full bg-white/[0.06] animate-pulse" />
              </div>
              <div className="p-4 flex gap-4">
                {[1, 2, 3].map(j => (
                  <div key={j} className="flex-shrink-0 w-[280px] rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-3 space-y-3 h-40">
                    <div className="h-3 w-20 rounded-full bg-white/[0.06] animate-pulse" />
                    <div className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl border-[0.3px] border-white/[0.05] bg-white/[0.01]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04]">
            <Kanban size={22} className="text-white/25" />
          </div>
          <p className="text-[13px] text-white/35">Aucun tableau kanban</p>
          <button
            type="button"
            onClick={() => setCreatingBoard(true)}
            className="flex items-center gap-2 px-4 h-9 rounded-xl bg-[#1f8a65] text-[13px] font-bold text-white hover:bg-[#217356] transition-colors"
          >
            <Plus size={14} />
            Créer un tableau
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleBoardDragStart}
          onDragEnd={handleBoardDragEnd}
        >
          <SortableContext items={boards.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
              {boards.map(board => (
                <SortableBoardSection
                  key={board.id}
                  board={board}
                  colAdded={colAdded[board.id] ?? 0}
                  isDragging={activeDragBoardId === board.id}
                  onRename={handleRenameBoard}
                  onDelete={handleDeleteBoard}
                  onAddColumn={boardId => setAddColModal({ boardId })}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeDragBoard && (
              <div className="rounded-2xl border border-[#1f8a65]/30 bg-[#181818] p-4 shadow-2xl opacity-90">
                <p className="text-[13px] font-bold text-white/60">{activeDragBoard.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {!loadingBoards && boards.length > 0 && boards.length < 10 && (
        <button
          type="button"
          onClick={() => setCreatingBoard(true)}
          className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl border-[0.3px] border-dashed border-white/[0.08] text-[12px] text-white/25 hover:text-white/50 hover:border-white/[0.16] transition-all"
        >
          <Plus size={13} />
          Ajouter un tableau
        </button>
      )}

      {/* Create board modal */}
      {creatingBoard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#181818] border-[0.3px] border-white/[0.08] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-white text-[15px] mb-1">Nouveau tableau Kanban</h3>
            <p className="text-[11px] text-white/30 mb-4">{10 - boards.length} emplacement{10 - boards.length !== 1 ? 's' : ''} restant{10 - boards.length !== 1 ? 's' : ''}</p>
            <form onSubmit={handleCreateBoard} className="space-y-3">
              <input
                autoFocus
                className="w-full rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-[14px] font-medium text-white placeholder:text-white/20 outline-none h-[44px]"
                placeholder="Nom du tableau"
                value={newBoardTitle}
                onChange={e => setNewBoardTitle(e.target.value)}
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => { setCreatingBoard(false); setNewBoardTitle('') }} className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium">Annuler</button>
                <button type="submit" disabled={!newBoardTitle.trim() || savingBoard} className="flex-1 py-2.5 rounded-xl bg-[#1f8a65] text-white text-[13px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors">{savingBoard ? '...' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add column modal */}
      {addColModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#181818] border-[0.3px] border-white/[0.08] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-white text-[15px] mb-1">Nouvelle colonne</h3>
            <p className="text-[11px] text-white/30 mb-4">Tableau : {boards.find(b => b.id === addColModal.boardId)?.title}</p>
            <form onSubmit={handleAddColumn} className="space-y-3">
              <input
                autoFocus
                className="w-full rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-[14px] font-medium text-white placeholder:text-white/20 outline-none h-[44px]"
                placeholder="Nom de la colonne"
                value={newColTitle}
                onChange={e => setNewColTitle(e.target.value)}
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => { setAddColModal(null); setNewColTitle('') }} className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium">Annuler</button>
                <button type="submit" disabled={!newColTitle.trim() || savingCol} className="flex-1 py-2.5 rounded-xl bg-[#1f8a65] text-white text-[13px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors">{savingCol ? '...' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
