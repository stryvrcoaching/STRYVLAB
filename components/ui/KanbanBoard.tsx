"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit3, Trash2, X, Check, GripVertical, Calendar, Link } from "lucide-react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type KanbanBoard = {
  id: string;
  title: string;
  created_at: string;
};

export type KanbanColumn = {
  id: string;
  board_id: string;
  title: string;
  order: number;
};

export type KanbanTask = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority: "high" | "medium" | "low";
  order: number;
  linked_event_id?: string | null;
  is_completed: boolean;
};

const PRIORITY_CONFIG = {
  high: { label: "Haute", class: "bg-red-500/20 text-red-400" },
  medium: { label: "Moyenne", class: "bg-yellow-500/15 text-yellow-400" },
  low: { label: "Basse", class: "bg-green-500/15 text-green-400" },
} as const;

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};

// ─── Droppable column wrapper ──────────────────────────────────────────────────

function DroppableColumn({
  columnId,
  isOver,
  children,
}: {
  columnId: string;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: columnId });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[60px] rounded-xl transition-colors duration-150 ${
        isOver ? "bg-[#1f8a65]/[0.06] ring-1 ring-[#1f8a65]/30" : ""
      }`}
    >
      {children}
    </div>
  );
}

// ─── Sortable task card ────────────────────────────────────────────────────────

function TaskCard({
  task,
  onDelete,
  onToggleComplete,
  isDragOverlay = false,
}: {
  task: KanbanTask;
  onDelete?: (id: string) => void;
  onToggleComplete?: (id: string, val: boolean) => void;
  isDragOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragOverlay) {
    return (
      <div className="rounded-xl bg-[#1e1e1e] border border-[#1f8a65]/40 p-3 shadow-2xl w-[260px] rotate-1">
        <span className="text-[13px] font-medium text-white">{task.title}</span>
        {task.description && (
          <p className="text-[11px] text-white/45 mt-1 leading-relaxed line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIORITY_CONFIG[task.priority].class}`}>
            {PRIORITY_CONFIG[task.priority].label}
          </span>
          {task.due_date && (
            <span className="text-[10px] text-white/30">{formatDate(task.due_date)}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl p-3 transition-all duration-150 ${
        isDragging
          ? "opacity-30 bg-white/[0.02] border border-dashed border-white/[0.12]"
          : task.is_completed
          ? "bg-white/[0.02]"
          : "bg-white/[0.04] hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Completion checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete?.(task.id, !task.is_completed);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-0.5 flex-shrink-0"
          aria-label={task.is_completed ? "Marquer non fait" : "Marquer fait"}
        >
          <div className={`w-3.5 h-3.5 rounded-[3px] flex items-center justify-center transition-all ${
            task.is_completed
              ? "bg-[#1f8a65]"
              : "border border-white/20 bg-transparent hover:border-[#1f8a65]/60"
          }`}>
            {task.is_completed && <Check size={9} className="text-white" strokeWidth={3} />}
          </div>
        </button>

        {/* Grip handle — listeners must receive pointer events, no stopPropagation */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 flex-shrink-0 cursor-grab text-white/20 hover:text-white/50 transition-colors active:cursor-grabbing touch-none"
          aria-label="Déplacer"
        >
          <GripVertical size={14} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className={`text-[13px] font-medium leading-snug transition-all ${
              task.is_completed ? "line-through text-white/30" : "text-white"
            }`}>
              {task.title}
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                aria-label="Supprimer"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {task.description && (
            <p className={`text-[11px] leading-relaxed mb-2 line-clamp-2 ${
              task.is_completed ? "text-white/25" : "text-white/45"
            }`}>
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIORITY_CONFIG[task.priority].class}`}>
              {PRIORITY_CONFIG[task.priority].label}
            </span>
            {task.due_date && (
              <span className="flex items-center gap-1 text-[10px] text-white/30">
                <Calendar size={9} />
                {formatDate(task.due_date)}
              </span>
            )}
            {task.linked_event_id && (
              <span className="flex items-center gap-1 text-[10px] text-[#1f8a65]/60" title="Lié à un événement agenda">
                <Link size={9} />
                Agenda
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add task inline form ──────────────────────────────────────────────────────

function AddTaskForm({
  columnId,
  boardId,
  columnTitle,
  onAdd,
  onCancel,
}: {
  columnId: string;
  boardId: string;
  columnTitle: string;
  onAdd: (task: KanbanTask) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [addToAgenda, setAddToAgenda] = useState(false);
  const [agendaTime, setAgendaTime] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      // Step 1 — create task
      const taskRes = await fetch("/api/organisation/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id:    boardId,
          column_id:   columnId,
          title:       title.trim(),
          description: description.trim() || null,
          due_date:    dueDate || null,
          priority,
        }),
      });
      if (!taskRes.ok) throw new Error("Failed to create task");
      const task = await taskRes.json();

      if (addToAgenda && dueDate) {
        // Step 2 — create linked event
        const evRes = await fetch("/api/organisation/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:               title.trim(),
            event_date:          dueDate,
            event_time:          agendaTime || null,
            description:         description.trim() || null,
            priority,
            linked_task_id:      task.id,
            linked_column_title: columnTitle,
          }),
        });
        if (evRes.ok) {
          const ev = await evRes.json();
          // Step 3 — backfill linked_event_id on the task
          await fetch(`/api/organisation/tasks?id=${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ linked_event_id: ev.id }),
          });
          task.linked_event_id = ev.id;
        }
      }

      onAdd({ ...task, is_completed: task.is_completed ?? false });
    } catch {
      // silent — keep form open
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl bg-[#0f0f0f] border-[0.3px] border-white/[0.07] p-3 space-y-2.5">
      <input
        autoFocus
        className="w-full rounded-lg bg-[#0a0a0a] px-3 py-2 text-[13px] text-white placeholder:text-white/20 outline-none"
        placeholder="Titre de la tâche"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="w-full rounded-lg bg-[#0a0a0a] px-3 py-2 text-[12px] text-white placeholder:text-white/20 outline-none"
        placeholder="Description (optionnel)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          type="date"
          className="flex-1 rounded-lg bg-[#0a0a0a] px-3 py-2 text-[12px] text-white outline-none"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <select
          className="rounded-lg bg-[#0a0a0a] px-2 py-2 text-[12px] text-white outline-none"
          value={priority}
          onChange={(e) => setPriority(e.target.value as "high" | "medium" | "low")}
        >
          <option value="high">Haute</option>
          <option value="medium">Moyenne</option>
          <option value="low">Basse</option>
        </select>
      </div>

      {/* Agenda sync toggle */}
      <button
        type="button"
        onClick={() => setAddToAgenda((v) => !v)}
        className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
          addToAgenda
            ? "bg-[#1f8a65]/15 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30"
            : "bg-white/[0.03] text-white/35 hover:bg-white/[0.06] hover:text-white/55"
        }`}
      >
        <Calendar size={12} />
        {addToAgenda ? "Ajoutera aussi à l'agenda" : "Ajouter aussi à l'agenda"}
        {addToAgenda && !dueDate && (
          <span className="ml-auto text-[10px] text-yellow-400/70">↑ date requise</span>
        )}
      </button>

      {/* Agenda time — only shown when sync is active and date is set */}
      {addToAgenda && dueDate && (
        <input
          type="time"
          className="w-full rounded-lg bg-[#0a0a0a] px-3 py-2 text-[12px] text-white outline-none"
          placeholder="Heure (optionnel)"
          value={agendaTime}
          onChange={(e) => setAgendaTime(e.target.value)}
        />
      )}

      <div className="flex gap-2 pt-0.5">
        <button
          type="submit"
          disabled={!title.trim() || saving || (addToAgenda && !dueDate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f8a65] text-[12px] font-semibold text-white hover:bg-[#217356] disabled:opacity-40 transition-colors"
        >
          <Check size={12} />
          {saving ? "..." : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-[12px] text-white/55 hover:bg-white/[0.08] transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

// ─── Kanban column card ────────────────────────────────────────────────────────

function KanbanColumnCard({
  column,
  tasks,
  boardId,
  isOver,
  onTaskAdded,
  onTaskDeleted,
  onTaskCompleted,
  onColumnRenamed,
  onColumnDeleted,
}: {
  column: KanbanColumn;
  tasks: KanbanTask[];
  boardId: string;
  isOver: boolean;
  onTaskAdded: (task: KanbanTask) => void;
  onTaskDeleted: (id: string) => void;
  onTaskCompleted: (id: string, val: boolean) => void;
  onColumnRenamed: (id: string, title: string) => void;
  onColumnDeleted: (id: string) => void;
}) {
  const [addingTask, setAddingTask] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const saveColumnTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === column.title) {
      setEditing(false);
      setTitleDraft(column.title);
      return;
    }
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/organisation/columns?id=${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error("Failed");
      onColumnRenamed(column.id, trimmed);
      setEditing(false);
    } catch {
      setTitleDraft(column.title);
      setEditing(false);
    } finally {
      setSavingTitle(false);
    }
  };

  const deleteColumn = async () => {
    const res = await fetch(`/api/organisation/columns?id=${column.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Erreur");
      return;
    }
    onColumnDeleted(column.id);
  };

  const completedCount = tasks.filter((t) => t.is_completed).length;

  return (
    <div
      className={`flex-shrink-0 w-[280px] flex flex-col rounded-xl border-[0.3px] p-3 transition-all duration-150 ${
        isOver
          ? "bg-[#1f8a65]/[0.05] border-[#1f8a65]/30"
          : "bg-white/[0.02] border-white/[0.06]"
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        {editing ? (
          <form
            onSubmit={(e) => { e.preventDefault(); saveColumnTitle(); }}
            className="flex flex-1 items-center gap-1.5"
          >
            <input
              autoFocus
              className="flex-1 min-w-0 rounded-lg bg-[#0a0a0a] px-2 py-1 text-[12px] font-semibold text-white outline-none"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
            />
            <button type="submit" disabled={savingTitle} className="text-[#1f8a65] hover:text-[#217356]">
              <Check size={14} />
            </button>
            <button type="button" onClick={() => { setEditing(false); setTitleDraft(column.title); }} className="text-white/30 hover:text-white/60">
              <X size={14} />
            </button>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50 truncate">
                {column.title}
              </span>
              <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md transition-colors ${
                tasks.length > 0 ? "bg-white/[0.06] text-white/40" : "text-white/20"
              }`}>
                {tasks.length}
              </span>
              {completedCount > 0 && (
                <span className="text-[10px] text-[#1f8a65]/60 font-medium">
                  {completedCount}✓
                </span>
              )}
            </div>
            <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity duration-150 ${showActions ? "opacity-100" : "opacity-0"}`}>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="p-1 rounded-md text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all"
                aria-label="Renommer"
              >
                <Edit3 size={12} />
              </button>
              <button
                type="button"
                onClick={deleteColumn}
                className="p-1 rounded-md text-white/25 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
                aria-label="Supprimer la colonne"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Task list — droppable zone */}
      <DroppableColumn columnId={column.id} isOver={isOver}>
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 min-h-[48px] p-1">
            {tasks.length === 0 && !addingTask && (
              <div className={`text-[11px] italic py-3 px-1 text-center transition-colors ${
                isOver ? "text-[#1f8a65]/60" : "text-white/20"
              }`}>
                {isOver ? "Déposer ici" : "Aucune tâche"}
              </div>
            )}
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onDelete={onTaskDeleted}
                onToggleComplete={onTaskCompleted}
              />
            ))}
          </div>
        </SortableContext>
      </DroppableColumn>

      {/* Add task */}
      {addingTask ? (
        <AddTaskForm
          columnId={column.id}
          boardId={boardId}
          columnTitle={column.title}
          onAdd={(task) => { onTaskAdded(task); setAddingTask(false); }}
          onCancel={() => setAddingTask(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAddingTask(true)}
          className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
        >
          <Plus size={12} />
          Ajouter une tâche
        </button>
      )}
    </div>
  );
}

// ─── Main KanbanBoard ──────────────────────────────────────────────────────────

interface KanbanBoardProps {
  boardId: string;
  onAddColumnRequest?: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ boardId, onAddColumnRequest }) => {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [colRes, taskRes] = await Promise.all([
        fetch(`/api/organisation/columns?boardId=${boardId}`),
        fetch(`/api/organisation/tasks?boardId=${boardId}`),
      ]);
      if (colRes.ok) setColumns(await colRes.json());
      if (taskRes.ok) {
        const raw = await taskRes.json();
        setTasks(raw.map((t: KanbanTask) => ({ ...t, is_completed: t.is_completed ?? false })));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getColumnIdFromOver = useCallback((overId: string): string | null => {
    if (columns.some((c) => c.id === overId)) return overId;
    const task = tasks.find((t) => t.id === overId);
    return task ? task.column_id : null;
  }, [columns, tasks]);

  // ─── DnD handlers ───────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
    setOverColumnId(task?.column_id ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverColumnId(null); return; }
    const colId = getColumnIdFromOver(String(over.id));
    setOverColumnId(colId);

    if (!activeTask) return;
    if (!colId || colId === activeTask.column_id) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeTask.id ? { ...t, column_id: colId } : t
      )
    );
    setActiveTask((prev) => prev ? { ...prev, column_id: colId } : prev);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setOverColumnId(null);

    const movedTask = tasks.find((t) => t.id === active.id);
    if (!movedTask) { setActiveTask(null); return; }
    if (!over) { setActiveTask(null); return; }

    const targetColId = getColumnIdFromOver(String(over.id));
    if (!targetColId) { setActiveTask(null); return; }

    // Reorder within same column
    if (targetColId === movedTask.column_id) {
      const targetTask = tasks.find((t) => t.id === over.id && t.id !== active.id);
      if (targetTask) {
        const colTasks = tasks
          .filter((t) => t.column_id === movedTask.column_id)
          .sort((a, b) => a.order - b.order);
        const oldIdx = colTasks.findIndex((t) => t.id === active.id);
        const newIdx = colTasks.findIndex((t) => t.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(colTasks, oldIdx, newIdx);
          setTasks((prev) => {
            const others = prev.filter((t) => t.column_id !== movedTask.column_id);
            return [...others, ...reordered];
          });
        }
      }
      setActiveTask(null);
      return;
    }

    // Move to different column — persist to API
    // DB trigger handles linked_column_title update automatically
    await fetch(`/api/organisation/tasks?id=${movedTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column_id: targetColId }),
    });

    setActiveTask(null);
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    setOverColumnId(null);
    loadData();
  };

  // ─── Column callbacks ────────────────────────────────────────────────────────

  const handleTaskAdded = (task: KanbanTask) => setTasks((prev) => [...prev, task]);

  const handleTaskDeleted = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/organisation/tasks?id=${id}`, { method: "DELETE" });
  };

  const handleTaskCompleted = async (id: string, val: boolean) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, is_completed: val } : t));
    await fetch(`/api/organisation/tasks?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_completed: val }),
    });
  };

  const handleColumnRenamed = (id: string, title: string) =>
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));

  const handleColumnDeleted = (id: string) => {
    const firstRemaining = columns.find((c) => c.id !== id);
    setColumns((prev) => prev.filter((c) => c.id !== id));
    if (firstRemaining) {
      setTasks((prev) =>
        prev.map((t) => (t.column_id === id ? { ...t, column_id: firstRemaining.id } : t))
      );
    } else {
      setTasks((prev) => prev.filter((t) => t.column_id !== id));
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-shrink-0 w-[280px] rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-3 space-y-3">
            <div className="h-3 w-20 rounded-full bg-white/[0.06] animate-pulse" />
            <div className="h-14 w-full rounded-xl bg-white/[0.04] animate-pulse" />
            <div className="h-14 w-full rounded-xl bg-white/[0.04] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <KanbanColumnCard
            key={col.id}
            column={col}
            tasks={tasks.filter((t) => t.column_id === col.id).sort((a, b) => a.order - b.order)}
            boardId={boardId}
            isOver={overColumnId === col.id && activeTask?.column_id !== col.id}
            onTaskAdded={handleTaskAdded}
            onTaskDeleted={handleTaskDeleted}
            onTaskCompleted={handleTaskCompleted}
            onColumnRenamed={handleColumnRenamed}
            onColumnDeleted={handleColumnDeleted}
          />
        ))}

        {/* Add column */}
        <div className="flex-shrink-0 w-[200px] flex items-start pt-2">
          <button
            type="button"
            onClick={onAddColumnRequest}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border-[0.3px] border-dashed border-white/[0.10] text-[11px] text-white/25 hover:text-white/50 hover:border-white/[0.20] hover:bg-white/[0.02] transition-all"
          >
            <Plus size={14} />
            Nouvelle colonne
          </button>
        </div>
      </div>

      {/* Drag overlay — ghost card */}
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
        {activeTask && <TaskCard task={activeTask} isDragOverlay />}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
