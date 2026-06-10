"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Calendar, Kanban, Check, Bell, Edit3, User, FileText, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

export type AgendaEvent = {
  id: string;
  coach_id?: string;
  title: string;
  event_date: string;
  event_time?: string | null;
  event_time_end?: string | null;
  description?: string | null;
  priority: "high" | "medium" | "low";
  created_at?: string;
  linked_task_id?: string | null;
  linked_column_title?: string | null;
  client_id?: string | null;
  template_type?: string | null;
  is_completed: boolean;
  notify_minutes_before?: number | null;
};

type BoardOption = { id: string; title: string };
type ColumnOption = { id: string; title: string };
type ClientOption = { id: string; first_name: string; last_name: string };
type ProgramTemplateOption = { id: string; name: string };
type AssessmentTemplateOption = { id: string; title: string };

interface AgendaCalendarProps {
  modalOpen?: boolean;
  setModalOpen?: (open: boolean) => void;
}

const VIEW_LABELS = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
  year: "Année",
} as const;

type AgendaView = keyof typeof VIEW_LABELS;

const PRIORITY_CONFIG = {
  high: { label: "Haute", class: "bg-red-500/20 text-red-400" },
  medium: { label: "Moyenne", class: "bg-yellow-500/15 text-yellow-400" },
  low: { label: "Basse", class: "bg-green-500/15 text-green-400" },
} as const;

const TEMPLATE_TYPES = [
  { value: "", label: "Aucun template" },
  { value: "seance", label: "Séance d'entraînement" },
  { value: "bilan", label: "Bilan client" },
  { value: "appel", label: "Appel de suivi" },
  { value: "autre", label: "Autre" },
] as const;

const NOTIFY_OPTIONS = [
  { value: 0, label: "Au moment de l'événement" },
  { value: 5, label: "5 min avant" },
  { value: 10, label: "10 min avant" },
  { value: 15, label: "15 min avant" },
  { value: 30, label: "30 min avant" },
  { value: 60, label: "1h avant" },
  { value: 1440, label: "1 jour avant" },
];

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const fmtDate = (date: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", opts).format(date);

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const getMonday = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

const buildMonthMatrix = (date: Date): Date[][] => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = getMonday(firstDay);
  const matrix: Date[][] = [];
  const cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    matrix.push(week);
  }
  return matrix;
};

const todayKey = toIsoDate(new Date());

// ─── Main Component ────────────────────────────────────────────────────────────

const AgendaCalendar: React.FC<AgendaCalendarProps> = ({
  modalOpen,
  setModalOpen,
}) => {
  const router = useRouter();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [view, setView] = useState<AgendaView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Assignation data — loaded lazily when a modal opens
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [programTemplates, setProgramTemplates] = useState<ProgramTemplateOption[]>([]);
  const [assessmentTemplates, setAssessmentTemplates] = useState<AssessmentTemplateOption[]>([]);
  const [loadingAssignData, setLoadingAssignData] = useState(false);
  const [assignDataLoaded, setAssignDataLoaded] = useState(false);

  // Modal state — controlled from parent OR internal
  const isControlled = modalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const effectiveOpen = isControlled ? modalOpen! : internalOpen;

  useEffect(() => {
    if (isControlled) setInternalOpen(modalOpen!);
  }, [isControlled, modalOpen]);

  // ─── Form state ──────────────────────────────────────────────────────────────
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(todayKey);
  const [newTime, setNewTime] = useState("");
  const [newTimeEnd, setNewTimeEnd] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newTemplateType, setNewTemplateType] = useState("");
  const [newNotify, setNewNotify] = useState<number | null>(null);
  const [addToKanban, setAddToKanban] = useState(false);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [columns, setKanbanColumns] = useState<ColumnOption[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedColumnId, setSelectedColumnId] = useState("");
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [saving, setSaving] = useState(false);
  // Assignation — creation modal
  const [newClientId, setNewClientId] = useState("");
  const [newProgramTemplateId, setNewProgramTemplateId] = useState("");
  const [newAssessmentTemplateId, setNewAssessmentTemplateId] = useState("");

  // Edit modal state
  const [editEvent, setEditEvent] = useState<AgendaEvent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editTimeEnd, setEditTimeEnd] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState<"high" | "medium" | "low">("medium");
  const [editTemplateType, setEditTemplateType] = useState("");
  const [editNotify, setEditNotify] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  // Assignation — edit modal
  const [editClientId, setEditClientId] = useState("");
  const [editProgramTemplateId, setEditProgramTemplateId] = useState("");
  const [editAssessmentTemplateId, setEditAssessmentTemplateId] = useState("");

  // ─── Modal open/close — defined after loadAssignData ─────────────────────────
  // (openModal is declared below loadAssignData to avoid hoisting issues)

  // Load clients + templates lazily on first modal open
  const loadAssignData = useCallback(async () => {
    if (assignDataLoaded || loadingAssignData) return;
    setLoadingAssignData(true);
    try {
      const [clientRes, progRes, assessRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/program-templates"),
        fetch("/api/assessments/templates"),
      ]);
      if (clientRes.ok) {
        const data = await clientRes.json();
        setClients(Array.isArray(data) ? data : []);
      }
      if (progRes.ok) {
        const data = await progRes.json();
        setProgramTemplates(Array.isArray(data) ? data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })) : []);
      }
      if (assessRes.ok) {
        const data = await assessRes.json();
        setAssessmentTemplates(Array.isArray(data) ? data.map((t: { id: string; title: string }) => ({ id: t.id, title: t.title })) : []);
      }
      setAssignDataLoaded(true);
    } catch { /* silent */ }
    finally { setLoadingAssignData(false); }
  }, [assignDataLoaded, loadingAssignData]);

  const openModal = useCallback(() => {
    isControlled ? setModalOpen?.(true) : setInternalOpen(true);
    loadAssignData();
  }, [isControlled, setModalOpen, loadAssignData]);

  const closeModal = useCallback(() => {
    isControlled ? setModalOpen?.(false) : setInternalOpen(false);
    resetForm();
  }, [isControlled, setModalOpen]);

  const openEdit = useCallback((ev: AgendaEvent) => {
    setEditEvent(ev);
    setEditTitle(ev.title);
    setEditDate(ev.event_date);
    setEditTime(ev.event_time ?? "");
    setEditTimeEnd(ev.event_time_end ?? "");
    setEditDesc(ev.description ?? "");
    setEditPriority(ev.priority);
    setEditTemplateType(ev.template_type ?? "");
    setEditNotify(ev.notify_minutes_before ?? null);
    setEditClientId(ev.client_id ?? "");
    setEditProgramTemplateId("");
    setEditAssessmentTemplateId("");
    loadAssignData();
  }, [loadAssignData]);

  const closeEdit = useCallback(() => setEditEvent(null), []);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEvent || !editTitle.trim() || !editDate) return;
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title:       editTitle.trim(),
        event_date:  editDate,
        event_time:  editTime || null,
        description: editDesc.trim() || null,
        priority:    editPriority,
        client_id:   editClientId || null,
      };
      if (editTimeEnd !== undefined)      payload.event_time_end        = editTimeEnd || null;
      if (editTemplateType !== undefined) payload.template_type         = editTemplateType || null;
      if (editNotify !== undefined)       payload.notify_minutes_before = editNotify;

      const res = await fetch(`/api/organisation/events?id=${editEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setEvents((prev) => prev.map((ev) => ev.id === editEvent.id ? { ...ev, ...updated } : ev));
      closeEdit();
    } catch {
      // silent
    } finally {
      setEditSaving(false);
    }
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDate(todayKey);
    setNewTime("");
    setNewTimeEnd("");
    setNewDesc("");
    setNewPriority("medium");
    setNewTemplateType("");
    setNewNotify(null);
    setAddToKanban(false);
    setBoards([]);
    setKanbanColumns([]);
    setSelectedBoardId("");
    setSelectedColumnId("");
    setNewClientId("");
    setNewProgramTemplateId("");
    setNewAssessmentTemplateId("");
  };

  // Load events
  useEffect(() => {
    setLoadingEvents(true);
    fetch("/api/organisation/events")
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data.map((e: AgendaEvent) => ({ ...e, is_completed: e.is_completed ?? false })) : []))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, []);

  // Load boards lazily when Kanban sync is toggled on
  const handleToggleKanban = useCallback(async () => {
    const next = !addToKanban;
    setAddToKanban(next);
    if (next && boards.length === 0) {
      setLoadingBoards(true);
      try {
        const res = await fetch("/api/organisation/boards");
        if (res.ok) {
          const data: BoardOption[] = await res.json();
          setBoards(data);
          if (data.length > 0) setSelectedBoardId(data[0].id);
        }
      } finally {
        setLoadingBoards(false);
      }
    }
  }, [addToKanban, boards.length]);

  // Load columns when board selection changes
  useEffect(() => {
    if (!selectedBoardId) { setKanbanColumns([]); setSelectedColumnId(""); return; }
    setLoadingColumns(true);
    fetch(`/api/organisation/columns?boardId=${selectedBoardId}`)
      .then((r) => r.json())
      .then((data: ColumnOption[]) => {
        setKanbanColumns(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setSelectedColumnId(data[0].id);
        else setSelectedColumnId("");
      })
      .catch(() => { setKanbanColumns([]); setSelectedColumnId(""); })
      .finally(() => setLoadingColumns(false));
  }, [selectedBoardId]);

  // ─── Date range ──────────────────────────────────────────────────────────────

  const startOfRange = useMemo(() => {
    if (view === "day") return new Date(currentDate);
    if (view === "week") return getMonday(currentDate);
    if (view === "month") return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return new Date(currentDate.getFullYear(), 0, 1);
  }, [currentDate, view]);

  const endOfRange = useMemo(() => {
    if (view === "day") return new Date(currentDate);
    if (view === "week") {
      const m = getMonday(currentDate);
      const s = new Date(m);
      s.setDate(m.getDate() + 6);
      return s;
    }
    if (view === "month") return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return new Date(currentDate.getFullYear(), 11, 31);
  }, [currentDate, view]);

  const visibleEvents = useMemo(() => {
    const startKey = toIsoDate(startOfRange);
    const endKey = toIsoDate(endOfRange);
    return events.filter((e) => e.event_date >= startKey && e.event_date <= endKey);
  }, [events, startOfRange, endOfRange]);

  const grouped = useMemo(() =>
    visibleEvents.reduce<Record<string, AgendaEvent[]>>((acc, ev) => {
      acc[ev.event_date] = acc[ev.event_date] || [];
      acc[ev.event_date].push(ev);
      return acc;
    }, {}),
    [visibleEvents]
  );

  const currentLabel = useMemo(() => {
    if (view === "day") return fmtDate(currentDate, { weekday: "long", day: "numeric", month: "long" });
    if (view === "week") {
      const mon = getMonday(currentDate);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `${fmtDate(mon, { day: "numeric", month: "short" })} — ${fmtDate(sun, { day: "numeric", month: "short" })}`;
    }
    if (view === "month") return fmtDate(currentDate, { month: "long", year: "numeric" });
    return String(currentDate.getFullYear());
  }, [currentDate, view]);

  // ─── Navigation ──────────────────────────────────────────────────────────────

  const navigate = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setCurrentDate(d);
  };

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title:                 newTitle.trim(),
        event_date:            newDate,
        event_time:            newTime || null,
        event_time_end:        newTimeEnd || null,
        description:           newDesc.trim() || null,
        priority:              newPriority,
        template_type:         newTemplateType || null,
        notify_minutes_before: newNotify,
        client_id:             newClientId || null,
      };

      // If syncing to Kanban, send target board/column so the API creates the task
      if (addToKanban && selectedBoardId && selectedColumnId) {
        payload.target_board_id  = selectedBoardId;
        payload.target_column_id = selectedColumnId;
      }

      const res = await fetch("/api/organisation/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      const created = await res.json();
      setEvents((prev) => [...prev, { ...created, is_completed: created.is_completed ?? false }]);
      closeModal();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/organisation/events?id=${id}`, { method: "DELETE" });
  };

  const handleToggleComplete = async (id: string, val: boolean) => {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, is_completed: val } : e));
    await fetch(`/api/organisation/events?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_completed: val }),
    });
  };

  // ─── Event card ──────────────────────────────────────────────────────────────

  const renderEvent = (ev: AgendaEvent) => (
    <div
      key={ev.id}
      className={`group flex items-start gap-2.5 rounded-lg p-2.5 transition-colors ${
        ev.is_completed ? "bg-white/[0.015]" : "bg-white/[0.03] hover:bg-white/[0.05]"
      }`}
    >
      {/* Completion checkbox */}
      <button
        type="button"
        onClick={() => handleToggleComplete(ev.id, !ev.is_completed)}
        className="mt-0.5 flex-shrink-0"
        aria-label={ev.is_completed ? "Marquer non fait" : "Marquer fait"}
      >
        <div className={`w-3.5 h-3.5 rounded-[3px] flex items-center justify-center transition-all ${
          ev.is_completed
            ? "bg-[#1f8a65]"
            : "border border-white/20 bg-transparent hover:border-[#1f8a65]/60"
        }`}>
          {ev.is_completed && <Check size={9} className="text-white" strokeWidth={3} />}
        </div>
      </button>

      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-medium leading-snug transition-all ${
          ev.is_completed ? "line-through text-white/30" : "text-white"
        }`}>
          {ev.title}
        </div>
        {ev.description && (
          <div className="text-[11px] text-white/45 leading-relaxed mt-0.5">{ev.description}</div>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIORITY_CONFIG[ev.priority].class}`}>
            {PRIORITY_CONFIG[ev.priority].label}
          </span>
          {ev.event_time && (
            <span className="text-[10px] text-white/30">
              {ev.event_time}{ev.event_time_end ? ` → ${ev.event_time_end}` : ""}
            </span>
          )}
          {ev.linked_column_title && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/45">
              <Kanban size={9} />
              {ev.linked_column_title}
            </span>
          )}
          {ev.template_type && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/35">
              {TEMPLATE_TYPES.find((t) => t.value === ev.template_type)?.label ?? ev.template_type}
            </span>
          )}
          {ev.notify_minutes_before != null && (
            <span className="flex items-center gap-1 text-[10px] text-white/25">
              <Bell size={9} />
              {ev.notify_minutes_before === 0
                ? "Au moment"
                : ev.notify_minutes_before >= 1440
                ? `${ev.notify_minutes_before / 1440}j`
                : ev.notify_minutes_before >= 60
                ? `${ev.notify_minutes_before / 60}h`
                : `${ev.notify_minutes_before}min`}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1">
        <button
          type="button"
          onClick={() => openEdit(ev)}
          className="p-1 rounded-md text-white/25 hover:text-white/70 hover:bg-white/[0.05] transition-all"
          aria-label="Modifier"
        >
          <Edit3 size={12} />
        </button>
        <button
          type="button"
          onClick={() => handleDelete(ev.id)}
          className="p-1 rounded-md text-white/25 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
          aria-label="Supprimer"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );

  // ─── Views ───────────────────────────────────────────────────────────────────

  const monthMatrix = useMemo(() => buildMonthMatrix(currentDate), [currentDate]);

  const yearMonths = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => new Date(currentDate.getFullYear(), i, 1)),
    [currentDate]
  );

  return (
    <div className="relative w-full">
      {/* Header — nav + view switcher */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30 mb-0.5">
              Agenda
            </p>
            <p className="text-[13px] font-semibold text-white capitalize">{currentLabel}</p>
          </div>
          <button
            onClick={() => navigate(1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 h-7 rounded-lg bg-white/[0.04] text-[11px] font-medium text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all"
          >
            Aujourd&apos;hui
          </button>
        </div>
        <div className="flex items-center gap-1">
          {(Object.entries(VIEW_LABELS) as [AgendaView, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 h-7 rounded-lg text-[11px] font-semibold transition-colors ${
                view === key
                  ? "bg-[#1f8a65] text-white"
                  : "bg-white/[0.04] text-white/45 hover:bg-white/[0.08] hover:text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loadingEvents ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 w-full rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Day view */}
          {view === "day" && (
            <div className="space-y-2">
              {(grouped[toIsoDate(currentDate)] ?? []).length === 0 ? (
                <EmptyState onAdd={openModal} />
              ) : (
                (grouped[toIsoDate(currentDate)] ?? []).map(renderEvent)
              )}
            </div>
          )}

          {/* Week view */}
          {view === "week" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => {
                const day = new Date(getMonday(currentDate));
                day.setDate(day.getDate() + i);
                const key = toIsoDate(day);
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    className={`rounded-xl p-3 border-[0.3px] transition-colors ${
                      isToday
                        ? "bg-[#1f8a65]/[0.06] border-[#1f8a65]/20"
                        : "bg-white/[0.02] border-white/[0.05]"
                    }`}
                  >
                    <div className={`text-[10px] font-semibold mb-2 ${isToday ? "text-[#1f8a65]" : "text-white/40"}`}>
                      {fmtDate(day, { weekday: "short", day: "numeric" })}
                    </div>
                    <div className="space-y-1.5">
                      {(grouped[key] ?? []).length === 0 ? (
                        <div className="text-[10px] text-white/15 italic">—</div>
                      ) : (
                        (grouped[key] ?? []).map((ev) => (
                          <div
                            key={ev.id}
                            className={`group flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 ${
                              ev.is_completed ? "bg-white/[0.015]" : "bg-white/[0.03]"
                            }`}
                          >
                            <span className={`text-[11px] truncate ${ev.is_completed ? "line-through text-white/30" : "text-white/70"}`}>
                              {ev.title}
                            </span>
                            {ev.linked_column_title && (
                              <Kanban size={9} className="text-[#1f8a65]/50 flex-shrink-0" />
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(ev.id)}
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 transition-all"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Month view */}
          {view === "month" && (
            <div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold text-white/25 uppercase tracking-wider py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthMatrix.flat().map((day) => {
                  const key = toIsoDate(day);
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isToday = key === todayKey;
                  const dayEvents = grouped[key] ?? [];
                  return (
                    <div
                      key={key}
                      className={`min-h-[80px] rounded-xl p-2 border-[0.3px] transition-colors ${
                        isToday
                          ? "bg-[#1f8a65]/[0.08] border-[#1f8a65]/25"
                          : isCurrentMonth
                          ? "bg-white/[0.02] border-white/[0.04]"
                          : "bg-transparent border-transparent"
                      }`}
                    >
                      <div className={`text-[11px] font-semibold mb-1 ${
                        isToday ? "text-[#1f8a65]" : isCurrentMonth ? "text-white/50" : "text-white/15"
                      }`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div key={ev.id} className={`rounded px-1.5 py-0.5 text-[10px] truncate flex items-center gap-1 ${
                            ev.is_completed ? "bg-white/[0.02] text-white/30 line-through" : "bg-white/[0.05] text-white/60"
                          }`}>
                            {ev.linked_column_title && <Kanban size={8} className="text-[#1f8a65]/50 flex-shrink-0" />}
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] text-white/25 px-1">+{dayEvents.length - 2}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Year view */}
          {view === "year" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {yearMonths.map((month) => {
                const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
                const count = events.filter((e) => e.event_date.startsWith(monthKey)).length;
                const completed = events.filter((e) => e.event_date.startsWith(monthKey) && e.is_completed).length;
                return (
                  <div
                    key={monthKey}
                    className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.05] p-4"
                  >
                    <p className="text-[11px] font-semibold text-white/50 mb-2 capitalize">
                      {fmtDate(month, { month: "long" })}
                    </p>
                    <p className="text-2xl font-black text-white leading-none mb-1">{count}</p>
                    <p className="text-[10px] text-white/25">
                      événement{count !== 1 ? "s" : ""}
                      {completed > 0 && <span className="ml-1 text-[#1f8a65]/60">{completed}✓</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add event modal */}
      {effectiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#181818] border-[0.3px] border-white/[0.08] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f8a65]/20">
                <Calendar size={15} className="text-[#1f8a65]" />
              </div>
              <h3 className="font-bold text-white text-[15px]">Nouvel événement</h3>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <input
                autoFocus
                className="w-full rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-[14px] font-medium text-white placeholder:text-white/20 outline-none h-[44px]"
                placeholder="Titre de l'événement"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none resize-none h-[70px]"
                placeholder="Description (optionnel)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />

              {/* Date */}
              <input
                type="date"
                className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />

              {/* Time range */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1">Début</p>
                  <input
                    type="time"
                    className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1">Fin</p>
                  <input
                    type="time"
                    className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                    value={newTimeEnd}
                    onChange={(e) => setNewTimeEnd(e.target.value)}
                  />
                </div>
              </div>

              {/* Priority */}
              <select
                className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as "high" | "medium" | "low")}
              >
                <option value="high">Priorité haute</option>
                <option value="medium">Priorité moyenne</option>
                <option value="low">Priorité basse</option>
              </select>

              {/* Template type */}
              <select
                className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                value={newTemplateType}
                onChange={(e) => setNewTemplateType(e.target.value)}
              >
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {/* Notification */}
              <div className="flex items-center gap-2">
                <Bell size={13} className="text-white/30 flex-shrink-0" />
                <select
                  className="flex-1 rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                  value={newNotify ?? ""}
                  onChange={(e) => setNewNotify(e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">Pas de rappel</option>
                  {NOTIFY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Kanban sync toggle */}
              <button
                type="button"
                onClick={handleToggleKanban}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[11px] font-medium transition-all ${
                  addToKanban
                    ? "bg-[#1f8a65]/15 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30"
                    : "bg-white/[0.03] text-white/35 hover:bg-white/[0.06] hover:text-white/55"
                }`}
              >
                <Kanban size={12} />
                {addToKanban ? "Sera ajouté au Kanban" : "Ajouter aussi au Kanban"}
              </button>

              {/* Board + column selector — shown when Kanban sync is active */}
              {addToKanban && (
                <div className="rounded-xl bg-[#0a0a0a] p-3 space-y-2">
                  {loadingBoards ? (
                    <div className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />
                  ) : boards.length === 0 ? (
                    <p className="text-[11px] text-white/30 text-center py-1">Aucun tableau disponible</p>
                  ) : (
                    <>
                      <div>
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">Tableau</p>
                        <select
                          className="w-full rounded-lg bg-[#181818] px-3 py-2 text-[12px] text-white outline-none"
                          value={selectedBoardId}
                          onChange={(e) => setSelectedBoardId(e.target.value)}
                        >
                          {boards.map((b) => (
                            <option key={b.id} value={b.id}>{b.title}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">Colonne</p>
                        {loadingColumns ? (
                          <div className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />
                        ) : columns.length === 0 ? (
                          <p className="text-[11px] text-white/25 italic px-1">Aucune colonne</p>
                        ) : (
                          <select
                            className="w-full rounded-lg bg-[#181818] px-3 py-2 text-[12px] text-white outline-none"
                            value={selectedColumnId}
                            onChange={(e) => setSelectedColumnId(e.target.value)}
                          >
                            {columns.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Assignations — client + templates */}
              <div className="rounded-xl bg-[#0a0a0a] p-3 space-y-3">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Assignations</p>

                {/* Client */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <User size={10} className="text-white/30" />
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Client</p>
                  </div>
                  {loadingAssignData ? (
                    <div className="h-9 rounded-lg bg-white/[0.04] animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-lg bg-[#181818] px-3 py-2 text-[12px] text-white outline-none"
                        value={newClientId}
                        onChange={(e) => setNewClientId(e.target.value)}
                      >
                        <option value="">Aucun client</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                        ))}
                      </select>
                      {newClientId && (
                        <button
                          type="button"
                          onClick={() => router.push(`/coach/clients/${newClientId}`)}
                          className="flex-shrink-0 p-1.5 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all"
                          title="Ouvrir le dossier client"
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Programme template */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <FileText size={10} className="text-white/30" />
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Template programme</p>
                  </div>
                  {loadingAssignData ? (
                    <div className="h-9 rounded-lg bg-white/[0.04] animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-lg bg-[#181818] px-3 py-2 text-[12px] text-white outline-none"
                        value={newProgramTemplateId}
                        onChange={(e) => setNewProgramTemplateId(e.target.value)}
                      >
                        <option value="">Aucun template</option>
                        {programTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {newProgramTemplateId && (
                        <button
                          type="button"
                          onClick={() => router.push(`/coach/programs/templates/${newProgramTemplateId}/view`)}
                          className="flex-shrink-0 p-1.5 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all"
                          title="Voir le template"
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Bilan template */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <FileText size={10} className="text-white/30" />
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Template bilan</p>
                  </div>
                  {loadingAssignData ? (
                    <div className="h-9 rounded-lg bg-white/[0.04] animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-lg bg-[#181818] px-3 py-2 text-[12px] text-white outline-none"
                        value={newAssessmentTemplateId}
                        onChange={(e) => setNewAssessmentTemplateId(e.target.value)}
                      >
                        <option value="">Aucun bilan</option>
                        {assessmentTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                      {newAssessmentTemplateId && (
                        <button
                          type="button"
                          onClick={() => router.push(`/coach/assessments`)}
                          className="flex-shrink-0 p-1.5 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all"
                          title="Voir les bilans"
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || !newDate || saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#1f8a65] text-white text-[13px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors"
                >
                  {saving ? "..." : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit event modal */}
      {editEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#181818] border-[0.3px] border-white/[0.08] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                <Edit3 size={14} className="text-white/60" />
              </div>
              <h3 className="font-bold text-white text-[15px] flex-1 min-w-0 truncate">
                Modifier l&apos;événement
              </h3>
              <button
                type="button"
                onClick={closeEdit}
                className="text-white/30 hover:text-white/70 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-3">
              <input
                autoFocus
                className="w-full rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-[14px] font-medium text-white placeholder:text-white/20 outline-none h-[44px]"
                placeholder="Titre de l'événement"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none resize-none h-[70px]"
                placeholder="Description (optionnel)"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
              <input
                type="date"
                className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1">Début</p>
                  <input
                    type="time"
                    className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1">Fin</p>
                  <input
                    type="time"
                    className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                    value={editTimeEnd}
                    onChange={(e) => setEditTimeEnd(e.target.value)}
                  />
                </div>
              </div>
              <select
                className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as "high" | "medium" | "low")}
              >
                <option value="high">Priorité haute</option>
                <option value="medium">Priorité moyenne</option>
                <option value="low">Priorité basse</option>
              </select>
              <select
                className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                value={editTemplateType}
                onChange={(e) => setEditTemplateType(e.target.value)}
              >
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Bell size={13} className="text-white/30 flex-shrink-0" />
                <select
                  className="flex-1 rounded-xl bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                  value={editNotify ?? ""}
                  onChange={(e) => setEditNotify(e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">Pas de rappel</option>
                  {NOTIFY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {editEvent.linked_column_title && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03]">
                  <Kanban size={11} className="text-[#1f8a65]/60" />
                  <span className="text-[11px] text-white/40">Lié à la colonne</span>
                  <span className="text-[11px] text-white/60 font-medium">{editEvent.linked_column_title}</span>
                </div>
              )}

              {/* Assignations — client + templates */}
              <div className="rounded-xl bg-[#0a0a0a] p-3 space-y-3">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Assignations</p>

                {/* Client */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <User size={10} className="text-white/30" />
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Client</p>
                  </div>
                  {loadingAssignData ? (
                    <div className="h-9 rounded-lg bg-white/[0.04] animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-lg bg-[#181818] px-3 py-2 text-[12px] text-white outline-none"
                        value={editClientId}
                        onChange={(e) => setEditClientId(e.target.value)}
                      >
                        <option value="">Aucun client</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                        ))}
                      </select>
                      {editClientId && (
                        <button
                          type="button"
                          onClick={() => router.push(`/coach/clients/${editClientId}`)}
                          className="flex-shrink-0 p-1.5 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all"
                          title="Ouvrir le dossier client"
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Programme template */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <FileText size={10} className="text-white/30" />
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Template programme</p>
                  </div>
                  {loadingAssignData ? (
                    <div className="h-9 rounded-lg bg-white/[0.04] animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-lg bg-[#181818] px-3 py-2 text-[12px] text-white outline-none"
                        value={editProgramTemplateId}
                        onChange={(e) => setEditProgramTemplateId(e.target.value)}
                      >
                        <option value="">Aucun template</option>
                        {programTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {editProgramTemplateId && (
                        <button
                          type="button"
                          onClick={() => router.push(`/coach/programs/templates/${editProgramTemplateId}/view`)}
                          className="flex-shrink-0 p-1.5 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all"
                          title="Voir le template"
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Bilan template */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <FileText size={10} className="text-white/30" />
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Template bilan</p>
                  </div>
                  {loadingAssignData ? (
                    <div className="h-9 rounded-lg bg-white/[0.04] animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-lg bg-[#181818] px-3 py-2 text-[12px] text-white outline-none"
                        value={editAssessmentTemplateId}
                        onChange={(e) => setEditAssessmentTemplateId(e.target.value)}
                      >
                        <option value="">Aucun bilan</option>
                        {assessmentTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                      {editAssessmentTemplateId && (
                        <button
                          type="button"
                          onClick={() => router.push(`/coach/assessments`)}
                          className="flex-shrink-0 p-1.5 rounded-lg bg-white/[0.04] text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all"
                          title="Voir les bilans"
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!editTitle.trim() || !editDate || editSaving}
                  className="flex-1 py-2.5 rounded-xl bg-[#1f8a65] text-white text-[13px] font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors"
                >
                  {editSaving ? "..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.04]">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04]">
        <Calendar size={18} className="text-white/25" />
      </div>
      <p className="text-[12px] text-white/30">Aucun événement ce jour</p>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] text-[12px] text-white/45 hover:bg-white/[0.08] hover:text-white/70 transition-all"
      >
        <Plus size={13} />
        Ajouter un événement
      </button>
    </div>
  );
}

export default AgendaCalendar;
