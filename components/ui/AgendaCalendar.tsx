"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Calendar, Kanban, Check, Bell, Edit3, User, FileText, ExternalLink, Video, Phone, MapPin, Link2, MessageSquare, AlertCircle } from "lucide-react";
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
  alert_at?: string | null;
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
  { value: "", label: "Aucun type" },
  { value: "seance", label: "Séance d'entraînement" },
  { value: "bilan", label: "Bilan client" },
  { value: "appel", label: "Appel de suivi" },
  { value: "rendez-vous", label: "Planifier un rendez-vous" },
  { value: "autre", label: "Autre" },
] as const;

type MeetingKindLocal = 'video' | 'phone' | 'in_person';
const MEETING_KINDS: { value: MeetingKindLocal; label: string; icon: React.ElementType }[] = [
  { value: 'video', label: 'Visioconférence', icon: Video },
  { value: 'phone', label: 'Téléphone', icon: Phone },
  { value: 'in_person', label: 'Présentiel', icon: MapPin },
];

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const fmtDate = (date: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", opts).format(date);

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

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

const today = new Date();
const todayKey = toDateKey(today);
const currentMonthKey = toMonthKey(today);

const formatAlertLabel = (event: AgendaEvent) => {
  if (event.alert_at) {
    const alertDate = new Date(event.alert_at);
    if (Number.isNaN(alertDate.getTime())) return "Alerte active";
    return `Alerte ${new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(alertDate)}`;
  }

  if (event.notify_minutes_before == null) return null;
  if (event.notify_minutes_before === 0) return "Alerte au moment";
  if (event.notify_minutes_before >= 1440) return `Alerte ${event.notify_minutes_before / 1440}j avant`;
  if (event.notify_minutes_before >= 60) return `Alerte ${event.notify_minutes_before / 60}h avant`;
  return `Alerte ${event.notify_minutes_before}min avant`;
};

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
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertDate, setAlertDate] = useState(todayKey);
  const [alertTime, setAlertTime] = useState("08:00");
  const [addToKanban, setAddToKanban] = useState(false);
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [columns, setKanbanColumns] = useState<ColumnOption[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedColumnId, setSelectedColumnId] = useState("");
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // Assignation — creation modal
  const [newClientId, setNewClientId] = useState("");
  const [newProgramTemplateId, setNewProgramTemplateId] = useState("");
  const [newAssessmentTemplateId, setNewAssessmentTemplateId] = useState("");
  // Rendez-vous fields (used when newTemplateType === "rendez-vous")
  const [apptMeetingKind, setApptMeetingKind] = useState<MeetingKindLocal>('video');
  const [apptMeetingUrl, setApptMeetingUrl] = useState('');
  const [apptClientMessage, setApptClientMessage] = useState('');
  const [apptConfirmationRequired, setApptConfirmationRequired] = useState(false);
  const [apptCreateKanbanTask, setApptCreateKanbanTask] = useState(true);

  // Edit modal state
  const [editEvent, setEditEvent] = useState<AgendaEvent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editTimeEnd, setEditTimeEnd] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState<"high" | "medium" | "low">("medium");
  const [editTemplateType, setEditTemplateType] = useState("");
  const [editAlertEnabled, setEditAlertEnabled] = useState(false);
  const [editAlertDate, setEditAlertDate] = useState(todayKey);
  const [editAlertTime, setEditAlertTime] = useState("08:00");
  const [editSaving, setEditSaving] = useState(false);
  // Assignation — edit modal
  const [editClientId, setEditClientId] = useState("");
  const [editProgramTemplateId, setEditProgramTemplateId] = useState("");
  const [editAssessmentTemplateId, setEditAssessmentTemplateId] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

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
        // /api/clients retourne { clients: [...] } — extraire le tableau
        const clientList = Array.isArray(data) ? data : (Array.isArray(data?.clients) ? data.clients : []);
        setClients(clientList);
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

  const openModal = useCallback((dateKey?: string) => {
    isControlled ? setModalOpen?.(true) : setInternalOpen(true);
    if (dateKey) {
      setNewDate(dateKey);
      setAlertDate(dateKey);
    }
    loadAssignData();
  }, [isControlled, setModalOpen, loadAssignData]);

  const closeModal = useCallback(() => {
    isControlled ? setModalOpen?.(false) : setInternalOpen(false);
    resetForm();
  }, [isControlled, setModalOpen]);

  const openEdit = useCallback((ev: AgendaEvent) => {
    if (ev.template_type === "appel" && ev.client_id) {
      router.push(`/coach/clients/${ev.client_id}/profil`);
      return;
    }
    setEditEvent(ev);
    setEditTitle(ev.title);
    setEditDate(ev.event_date);
    setEditTime(ev.event_time ?? "");
    setEditTimeEnd(ev.event_time_end ?? "");
    setEditDesc(ev.description ?? "");
    setEditPriority(ev.priority);
    setEditTemplateType(ev.template_type ?? "");
    setEditAlertEnabled(Boolean(ev.alert_at || ev.notify_minutes_before != null));
    setEditAlertDate(ev.alert_at ? ev.alert_at.slice(0, 10) : ev.event_date);
    setEditAlertTime(ev.alert_at ? ev.alert_at.slice(11, 16) : "08:00");
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
        notify_minutes_before: null,
        alert_at: editAlertEnabled ? `${editAlertDate}T${editAlertTime || '08:00'}:00` : null,
      };
      if (editTimeEnd !== undefined)      payload.event_time_end        = editTimeEnd || null;
      if (editTemplateType !== undefined) payload.template_type         = editTemplateType || null;

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
    setAlertEnabled(false);
    setAlertDate(todayKey);
    setAlertTime("08:00");
    setAddToKanban(false);
    setBoards([]);
    setKanbanColumns([]);
    setSelectedBoardId("");
    setSelectedColumnId("");
    setNewClientId("");
    setNewProgramTemplateId("");
    setNewAssessmentTemplateId("");
    setAddError(null);
    setApptMeetingKind('video');
    setApptMeetingUrl('');
    setApptClientMessage('');
    setApptConfirmationRequired(false);
    setApptCreateKanbanTask(true);
  };

  // Load events
  useEffect(() => {
    setLoadingEvents(true);
    Promise.all([
      fetch("/api/organisation/events").then((r) => r.json()).catch(() => []),
      fetch("/api/coach/appointments").then((r) => r.json()).catch(() => []),
    ])
      .then(([eventsData, appointmentsData]) => {
        const normalEvents = Array.isArray(eventsData)
          ? eventsData.map((e: AgendaEvent) => ({ ...e, is_completed: e.is_completed ?? false }))
          : [];

        const mappedAppointments = Array.isArray(appointmentsData)
          ? appointmentsData.map((a: any) => {
              const startDate = new Date(a.starts_at);
              const endDate = new Date(a.ends_at);
              const pad = (n: number) => String(n).padStart(2, "0");
              const event_date = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
              const event_time = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
              const event_time_end = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;

              return {
                id: a.id,
                coach_id: a.coach_id,
                title: `📞 ${a.title}`,
                event_date,
                event_time,
                event_time_end,
                description: a.client_message,
                priority: "high" as const,
                is_completed: ["completed", "no_show"].includes(a.status),
                client_id: a.client_id,
                template_type: "appel",
                meeting_kind: a.meeting_kind,
                meeting_url: a.meeting_url,
                status: a.status,
              } as AgendaEvent;
            })
          : [];

        setEvents([...normalEvents, ...mappedAppointments]);
      })
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
    const startKey = toDateKey(startOfRange);
    const endKey = toDateKey(endOfRange);
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
    setAddError(null);

    // Si type rendez-vous : appel dédié à /api/coach/appointments
    if (newTemplateType === 'rendez-vous') {
      if (!newClientId) {
        setAddError('Sélectionne un client pour planifier un rendez-vous.');
        return;
      }
      if (!newDate || !newTime) {
        setAddError('Date et heure de début requises pour un rendez-vous.');
        return;
      }
      setSaving(true);
      try {
        // Construire starts_at / ends_at
        const durationMin = newTimeEnd && newTime
          ? (() => {
              const [sh, sm] = newTime.split(':').map(Number);
              const [eh, em] = newTimeEnd.split(':').map(Number);
              return (eh * 60 + em) - (sh * 60 + sm);
            })()
          : 60;
        const startsAt = new Date(`${newDate}T${newTime}:00`).toISOString();
        const endsAt = new Date(new Date(`${newDate}T${newTime}:00`).getTime() + Math.max(durationMin, 15) * 60_000).toISOString();

        const res = await fetch('/api/coach/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: newClientId,
            title: newTitle.trim(),
            starts_at: startsAt,
            ends_at: endsAt,
            meeting_kind: apptMeetingKind,
            meeting_url: apptMeetingUrl.trim() || null,
            client_message: apptClientMessage.trim() || null,
            confirmation_required: apptConfirmationRequired,
            create_kanban_task: apptCreateKanbanTask,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setAddError(json?.error ?? 'Impossible de créer le rendez-vous.');
          return;
        }
        // Mapper le rendez-vous en événement agenda local
        const appt = json.appointment;
        const startDate = new Date(appt.starts_at);
        const endDate = new Date(appt.ends_at);
        const pad = (n: number) => String(n).padStart(2, '0');
        const mappedEvent: AgendaEvent = {
          id: appt.id,
          coach_id: appt.coach_id,
          title: `📞 ${appt.title}`,
          event_date: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
          event_time: `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`,
          event_time_end: `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`,
          description: appt.client_message,
          priority: 'high',
          is_completed: false,
          client_id: appt.client_id,
          template_type: 'appel',
        };
        setEvents((prev) => [...prev, mappedEvent]);
        closeModal();
      } catch {
        setAddError('Erreur réseau. Réessaie.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Événement standard
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
        notify_minutes_before: null,
        alert_at:              alertEnabled ? `${alertDate}T${alertTime || '08:00'}:00` : null,
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
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setAddError(json?.error ? String(json.error) : 'Impossible de créer l\'événement.');
        return;
      }
      const created = await res.json();
      setEvents((prev) => [...prev, { ...created, is_completed: created.is_completed ?? false }]);
      closeModal();
    } catch {
      setAddError('Erreur réseau. Réessaie.');
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
          <button
            type="button"
            onClick={() => openEdit(ev)}
            className="text-left transition-colors hover:text-[#8ef0c7]"
          >
            {ev.title}
          </button>
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
          {formatAlertLabel(ev) ? (
            <span className="flex items-center gap-1 text-[10px] text-white/25">
              <Bell size={9} />
              {formatAlertLabel(ev)}
            </span>
          ) : null}
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
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => openModal(toDateKey(currentDate))}
                  className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2 text-[11px] text-white/60 transition-all hover:bg-white/[0.08] hover:text-white"
                >
                  <Plus size={12} />
                  Ajouter un événement
                </button>
              </div>
              {(grouped[toDateKey(currentDate)] ?? []).length === 0 ? (
                <EmptyState onAdd={() => openModal(toDateKey(currentDate))} />
              ) : (
                (grouped[toDateKey(currentDate)] ?? []).map(renderEvent)
              )}
            </div>
          )}

          {/* Week view */}
          {view === "week" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => {
                const day = new Date(getMonday(currentDate));
                day.setDate(day.getDate() + i);
                const key = toDateKey(day);
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedDateKey(key)}
                    className={`cursor-pointer rounded-xl p-3 border-[0.3px] transition-colors ${
                      isToday
                        ? "bg-[#1f8a65]/[0.06] border-[#1f8a65]/20 hover:bg-[#1f8a65]/[0.12] hover:border-[#1f8a65]/35"
                        : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1]"
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
                            className={`group flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                              ev.is_completed
                                ? "bg-white/[0.015] hover:bg-white/[0.03]"
                                : "bg-white/[0.03] hover:bg-white/[0.05]"
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
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDelete(ev.id);
                              }}
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
                  const key = toDateKey(day);
                  const isCurrentMonth =
                    day.getMonth() === currentDate.getMonth() &&
                    day.getFullYear() === currentDate.getFullYear();
                  const isToday = key === todayKey;
                  const dayEvents = grouped[key] ?? [];
                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedDateKey(key)}
                      className={`min-h-[80px] cursor-pointer rounded-xl p-2 border-[0.3px] transition-colors ${
                        isToday
                          ? "bg-[#1f8a65]/[0.08] border-[#1f8a65]/25 hover:bg-[#1f8a65]/[0.12] hover:border-[#1f8a65]/35"
                          : isCurrentMonth
                          ? "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.1]"
                          : "bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]"
                      }`}
                    >
                      <div className={`text-[11px] font-semibold mb-1 ${
                        isToday ? "text-[#1f8a65]" : isCurrentMonth ? "text-white/50" : "text-white/15"
                      }`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div key={ev.id} className={`rounded px-1.5 py-0.5 text-[10px] truncate flex items-center gap-1 transition-colors ${
                            ev.is_completed
                              ? "bg-white/[0.02] text-white/30 line-through hover:bg-white/[0.04]"
                              : "bg-white/[0.05] text-white/60 hover:bg-white/[0.08]"
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
                const monthKey = toMonthKey(month);
                const isCurrentMonth = monthKey === currentMonthKey;
                const count = events.filter((e) => e.event_date.startsWith(monthKey)).length;
                const completed = events.filter((e) => e.event_date.startsWith(monthKey) && e.is_completed).length;
                return (
                  <div
                    key={monthKey}
                    onClick={() => {
                      setCurrentDate(month);
                      setView("month");
                    }}
                    className={`cursor-pointer rounded-xl border-[0.3px] p-4 transition-colors ${
                      isCurrentMonth
                        ? "bg-[#1f8a65]/[0.08] border-[#1f8a65]/25 hover:bg-[#1f8a65]/[0.12] hover:border-[#1f8a65]/35"
                        : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]"
                    }`}
                  >
                    <p className={`mb-2 text-[11px] font-semibold capitalize ${isCurrentMonth ? "text-[#1f8a65]" : "text-white/50"}`}>
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

      {selectedDateKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#181818] border-[0.3px] border-white/[0.08] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">Agenda</p>
                <h3 className="mt-1 text-[15px] font-bold text-white">
                  {fmtDate(new Date(`${selectedDateKey}T12:00:00`), {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateKey(null)}
                className="text-white/30 hover:text-white/70 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDateKey(null);
                openModal(selectedDateKey);
              }}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f8a65] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#217356] transition-colors"
            >
              <Plus size={13} />
              Ajouter un événement
            </button>

            <div className="space-y-2">
              {(grouped[selectedDateKey] ?? []).length === 0 ? (
                <EmptyState onAdd={() => {
                  setSelectedDateKey(null);
                  openModal(selectedDateKey);
                }} />
              ) : (
                (grouped[selectedDateKey] ?? []).map(renderEvent)
              )}
            </div>
          </div>
        </div>
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

              <div className="rounded-xl bg-[#0a0a0a] p-3 space-y-3">
                <button
                  type="button"
                  onClick={() => setAlertEnabled((prev) => !prev)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12px] font-medium transition-all ${
                    alertEnabled
                      ? "bg-[#1f8a65]/15 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30"
                      : "bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/65"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Bell size={12} />
                    {alertEnabled ? "Alerte activée" : "Activer une alerte"}
                  </span>
                  <span className="text-[10px]">{alertEnabled ? "Oui" : "Non"}</span>
                </button>

                {alertEnabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      className="w-full rounded-xl bg-[#181818] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                      value={alertDate}
                      onChange={(e) => setAlertDate(e.target.value)}
                    />
                    <input
                      type="time"
                      className="w-full rounded-xl bg-[#181818] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                      value={alertTime}
                      onChange={(e) => setAlertTime(e.target.value)}
                    />
                  </div>
                )}
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

                {/* Programme template — masqué si type rendez-vous */}
                {newTemplateType !== 'rendez-vous' && (
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
                )}

                {/* Bilan template — masqué si type rendez-vous */}
                {newTemplateType !== 'rendez-vous' && (
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
                )}
              </div>

              {/* Panneau Rendez-vous — visible uniquement si type = rendez-vous */}
              {newTemplateType === 'rendez-vous' && (
                <div className="rounded-xl bg-[#0a0a0a] p-3 space-y-3">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Détails du rendez-vous</p>

                  {/* Modalité */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {MEETING_KINDS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setApptMeetingKind(value)}
                        className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border text-[11px] font-medium transition-all ${
                          apptMeetingKind === value
                            ? 'border-[#1f8a65]/50 bg-[#1f8a65]/10 text-[#1f8a65]'
                            : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/20'
                        }`}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Lien de participation — conditionnel visio */}
                  {apptMeetingKind === 'video' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Link2 size={10} className="text-white/30" />
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Lien de participation</p>
                      </div>
                      <input
                        type="url"
                        value={apptMeetingUrl}
                        onChange={(e) => setApptMeetingUrl(e.target.value)}
                        placeholder="https://meet.google.com/..."
                        className="w-full rounded-lg bg-[#181818] px-3 py-2 text-[12px] text-white placeholder:text-white/20 outline-none"
                      />
                    </div>
                  )}

                  {/* Message de préparation */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare size={10} className="text-white/30" />
                      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Message de préparation</p>
                    </div>
                    <textarea
                      value={apptClientMessage}
                      onChange={(e) => setApptClientMessage(e.target.value)}
                      rows={2}
                      placeholder="Objectif, consignes, documents à préparer..."
                      className="w-full rounded-lg bg-[#181818] px-3 py-2 text-[12px] text-white placeholder:text-white/20 outline-none resize-none"
                    />
                  </div>

                  {/* Options confirmation + Kanban */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setApptConfirmationRequired(!apptConfirmationRequired)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-medium transition-all bg-white/[0.03] hover:bg-white/[0.06] text-white/50 hover:text-white/70"
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                        apptConfirmationRequired ? 'bg-[#1f8a65] border-[#1f8a65]' : 'border-white/20'
                      }`}>
                        {apptConfirmationRequired && <Check size={9} className="text-white" strokeWidth={3} />}
                      </div>
                      Demander une confirmation au client
                    </button>
                    <button
                      type="button"
                      onClick={() => setApptCreateKanbanTask(!apptCreateKanbanTask)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-medium transition-all bg-white/[0.03] hover:bg-white/[0.06] text-white/50 hover:text-white/70"
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                        apptCreateKanbanTask ? 'bg-[#1f8a65] border-[#1f8a65]' : 'border-white/20'
                      }`}>
                        {apptCreateKanbanTask && <Check size={9} className="text-white" strokeWidth={3} />}
                      </div>
                      Créer une tâche de préparation dans le Kanban
                    </button>
                  </div>
                </div>
              )}

              {/* Erreur inline */}
              {addError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border-[0.3px] border-red-500/20 px-3 py-2.5">
                  <AlertCircle size={13} className="text-red-400 shrink-0" />
                  <p className="text-[12px] text-red-400">{addError}</p>
                </div>
              )}

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
                  {saving ? "..." : newTemplateType === 'rendez-vous' ? 'Planifier' : 'Ajouter'}
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
              <div className="rounded-xl bg-[#0a0a0a] p-3 space-y-3">
                <button
                  type="button"
                  onClick={() => setEditAlertEnabled((prev) => !prev)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12px] font-medium transition-all ${
                    editAlertEnabled
                      ? "bg-[#1f8a65]/15 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30"
                      : "bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/65"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Bell size={12} />
                    {editAlertEnabled ? "Alerte activée" : "Activer une alerte"}
                  </span>
                  <span className="text-[10px]">{editAlertEnabled ? "Oui" : "Non"}</span>
                </button>

                {editAlertEnabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      className="w-full rounded-xl bg-[#181818] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                      value={editAlertDate}
                      onChange={(e) => setEditAlertDate(e.target.value)}
                    />
                    <input
                      type="time"
                      className="w-full rounded-xl bg-[#181818] px-3 py-2.5 text-[13px] text-white outline-none h-[44px]"
                      value={editAlertTime}
                      onChange={(e) => setEditAlertTime(e.target.value)}
                    />
                  </div>
                )}
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
