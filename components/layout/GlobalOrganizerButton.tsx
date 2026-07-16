"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus2, CircleHelp, ClipboardList, KanbanSquare, ListTodo, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  getClientName,
  getContextCopy,
  getContextDraft,
  getCurrentClientIdFromPath,
  getHelpContent,
  getOrderedPresets,
  getPresetById,
  getRecommendationCopy,
  getRecommendedPresetId,
  type OrganizerClient as CoachClient,
  type OrganizerMode,
  type OrganizerPreset,
} from "@/lib/coach/organizer-context";

type GlobalOrganizerButtonProps = {
  initialOpen?: boolean;
  initialHelpOpen?: boolean;
  initialClients?: CoachClient[];
  initialPathname?: string;
};

const MODE_OPTIONS: Array<{
  value: OrganizerMode;
  label: string;
  icon: typeof CalendarPlus2;
}> = [
  { value: "both", label: "Les deux", icon: ListTodo },
  { value: "agenda", label: "Agenda", icon: CalendarPlus2 },
  { value: "kanban", label: "Kanban", icon: KanbanSquare },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Faible" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Prioritaire" },
] as const;

type BoardOption = { id: string; title: string };
type ColumnOption = { id: string; title: string };

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function GlobalOrganizerButton({
  initialOpen = false,
  initialHelpOpen = false,
  initialClients = [],
  initialPathname,
}: GlobalOrganizerButtonProps = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(initialOpen);
  const [helpOpen, setHelpOpen] = useState(initialHelpOpen);
  const [clients, setClients] = useState<CoachClient[]>(initialClients);
  const [clientsRequested, setClientsRequested] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<OrganizerMode>("both");
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(getTodayDate);
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertDate, setAlertDate] = useState(getTodayDate);
  const [alertTime, setAlertTime] = useState("08:00");
  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [columns, setColumns] = useState<ColumnOption[]>([]);
  const [boardId, setBoardId] = useState("");
  const [columnId, setColumnId] = useState("");
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId) ?? null,
    [clientId, clients],
  );
  const selectedClientName = useMemo(() => getClientName(selectedClient), [selectedClient]);
  const currentPathname = initialPathname ?? pathname;
  const currentClientIdFromPath = useMemo(() => getCurrentClientIdFromPath(currentPathname), [currentPathname]);
  const recommendedPresetId = useMemo(() => getRecommendedPresetId(currentPathname), [currentPathname]);
  const recommendedPreset = useMemo(() => getPresetById(recommendedPresetId), [recommendedPresetId]);
  const contextCopy = useMemo(() => getContextCopy(currentPathname), [currentPathname]);
  const helpContent = useMemo(() => getHelpContent(currentPathname), [currentPathname]);
  const orderedPresets = useMemo(() => getOrderedPresets(recommendedPresetId), [recommendedPresetId]);

  const recommendation = useMemo(() => getRecommendationCopy(mode), [mode]);
  const needsKanbanTarget = mode === "kanban" || mode === "both";
  const usesAgenda = mode === "agenda" || mode === "both";

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || clientsRequested || loadingClients) return;

    let cancelled = false;

    async function loadClients() {
      setClientsRequested(true);
      setLoadingClients(true);
      setError(null);

      const res = await fetch("/api/clients", { cache: "no-store" });
      const data = await res.json().catch(() => ({ clients: [] }));

      if (cancelled) return;

      if (!res.ok) {
        setError(data?.error ?? "Impossible de charger les clients");
        setLoadingClients(false);
        return;
      }

      const nextClients = Array.isArray(data.clients) ? data.clients : [];
      setClients((prev) => {
        const merged = [...prev, ...nextClients]
        const deduped = new Map(merged.map((client) => [client.id, client]))
        return Array.from(deduped.values())
      });
      setLoadingClients(false);
    }

    void loadClients();

    return () => {
      cancelled = true;
    };
  }, [clientsRequested, loadingClients, open]);

  useEffect(() => {
    if (!open || !needsKanbanTarget || boards.length > 0 || loadingBoards) return;

    let cancelled = false;

    async function loadBoards() {
      setLoadingBoards(true);
      const res = await fetch("/api/organisation/boards", { cache: "no-store" });
      const data = await res.json().catch(() => []);

      if (cancelled) return;

      if (!res.ok) {
        setLoadingBoards(false);
        return;
      }

      const nextBoards = Array.isArray(data) ? data : [];
      setBoards(nextBoards);
      setBoardId((prev) => prev || nextBoards[0]?.id || "");
      setLoadingBoards(false);
    }

    void loadBoards();

    return () => {
      cancelled = true;
    };
  }, [boards.length, loadingBoards, needsKanbanTarget, open]);

  useEffect(() => {
    if (!needsKanbanTarget || !boardId) {
      setColumns([]);
      setColumnId("");
      return;
    }

    let cancelled = false;

    async function loadColumns() {
      setLoadingColumns(true);
      const res = await fetch(`/api/organisation/columns?boardId=${boardId}`, { cache: "no-store" });
      const data = await res.json().catch(() => []);

      if (cancelled) return;

      if (!res.ok) {
        setColumns([]);
        setColumnId("");
        setLoadingColumns(false);
        return;
      }

      const nextColumns = Array.isArray(data) ? data : [];
      setColumns(nextColumns);
      setColumnId((prev) => {
        if (prev && nextColumns.some((column) => column.id === prev)) return prev;
        return nextColumns[0]?.id || "";
      });
      setLoadingColumns(false);
    }

    void loadColumns();

    return () => {
      cancelled = true;
    };
  }, [boardId, needsKanbanTarget]);

  useEffect(() => {
    if (!currentClientIdFromPath) return
    setClientId((prev) => prev || currentClientIdFromPath)
  }, [currentClientIdFromPath]);

  useEffect(() => {
    if (!selectedClient) return;
    if (title.trim().length > 0) return;
    const recommendedDraft = recommendedPreset ? {
      title: recommendedPreset.buildTitle(getClientName(selectedClient)),
      note: recommendedPreset.buildNote(getClientName(selectedClient)),
      mode: recommendedPreset.mode,
    } : null
    const draft = getContextDraft(currentPathname, getClientName(selectedClient));
    setTitle(recommendedDraft?.title ?? draft.title);
    if (!note.trim().length) {
      const nextNote = recommendedDraft?.note ?? draft.note
      if (nextNote) {
        setNote(nextNote);
      }
    }
    if (recommendedDraft && mode === "both") {
      setMode(recommendedDraft.mode);
    }
  }, [currentPathname, mode, note, recommendedPreset, selectedClient, title]);

  function resetState() {
    setMode("both");
    setClientId(currentClientIdFromPath);
    setTitle("");
    setDate(getTodayDate());
    setTime("09:00");
    setNote("");
    setPriority("medium");
    setAlertEnabled(false);
    setAlertDate(getTodayDate());
    setAlertTime("08:00");
    setError(null);
  }

  function applyPreset(preset: OrganizerPreset) {
    const targetName = selectedClientName || "client";
    setMode(preset.mode);
    setTitle(preset.buildTitle(targetName));
    setNote(preset.buildNote(targetName));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId) return;

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/coach/organizer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        mode,
        title: title.trim(),
        date,
        time: time.trim(),
        note: note.trim(),
        priority,
        boardId,
        columnId,
        alertEnabled: usesAgenda ? alertEnabled : false,
        alertDate: usesAgenda && alertEnabled ? alertDate : "",
        alertTime: usesAgenda && alertEnabled ? alertTime : "",
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error ?? "Impossible de créer l'action");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    resetState();
    setOpen(false);
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
            open ? "bg-white/[0.08] text-white/80" : "text-white/35 hover:bg-white/[0.06] hover:text-white/70"
          }`}
          title="Organiser"
          aria-label="Organiser"
        >
          <ClipboardList size={13} strokeWidth={1.8} />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-30">
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 bg-black/55"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-4 top-[5.25rem] bottom-4 w-[24rem] max-w-[calc(100vw-2rem)] rounded-[24px] border-[0.3px] border-white/[0.06] bg-[#121212] shadow-[0_24px_80px_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">Organisation</p>
                  <p className="mt-1 text-[15px] font-semibold text-white">Créer une action coach</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-all hover:bg-white/[0.06] hover:text-white/80"
                    aria-label="Informations sur l'organisation"
                    title="Informations"
                  >
                    <CircleHelp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-all hover:bg-white/[0.06] hover:text-white/80"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                <div className="rounded-2xl border border-white/[0.06] bg-[#181818] p-3.5">
                  <p className="text-[11px] font-semibold text-white">{contextCopy.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/55">{contextCopy.body}</p>
                  <div className="mt-3 h-px bg-white/[0.06]" />
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/32">{recommendation.title}</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-white/48">{recommendation.body}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">Presets smart</p>
                  <div className="grid grid-cols-1 gap-2">
                    {orderedPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="rounded-2xl border border-white/[0.06] bg-[#181818] px-3.5 py-3 text-left transition-all hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold text-white">{preset.label}</p>
                          <div className="flex items-center gap-1.5">
                            {preset.id === recommendedPresetId ? (
                              <span className="rounded-full bg-[#1f8a65]/14 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#8ef0c7]">
                                Recommandé
                              </span>
                            ) : null}
                            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/32">
                              {preset.subtitle}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-[10.5px] leading-relaxed text-white/48">
                          {preset.mode === "both"
                            ? "Alerte + Kanban"
                            : preset.mode === "agenda"
                              ? "Alerte datée"
                              : "Tâche Kanban"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="organizer-client" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                      Client
                    </label>
                    <div className="rounded-2xl border border-white/[0.06] bg-[#181818] px-3 py-2.5">
                      <select
                        id="organizer-client"
                        value={clientId}
                        onChange={(event) => setClientId(event.target.value)}
                        className="w-full bg-transparent text-[13px] text-white outline-none"
                      >
                        <option value="" className="bg-[#181818] text-white/50">
                          {loadingClients ? "Chargement des clients..." : "Choisir un client"}
                        </option>
                        {clientId && !selectedClient ? (
                          <option value={clientId} className="bg-[#181818] text-white">
                            Client actuel détecté
                          </option>
                        ) : null}
                        {clients.map((client) => (
                          <option key={client.id} value={client.id} className="bg-[#181818] text-white">
                            {getClientName(client) || client.email || "Client"}
                          </option>
                        ))}
                      </select>
                    </div>
                    {error ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                        <span>{error}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setClientsRequested(false);
                            setLoadingClients(false);
                          }}
                          className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-white/75 hover:bg-white/[0.1]"
                        >
                          Réessayer
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">Type d'action</p>
                    <div className="grid grid-cols-3 gap-2">
                      {MODE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const active = mode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setMode(option.value)}
                            className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                              active
                                ? "border-[#1f8a65]/70 bg-[#1f8a65]/16 text-white"
                                : "border-white/[0.06] bg-[#181818] text-white/55 hover:text-white/80"
                            }`}
                          >
                            <Icon size={14} className="mb-2" />
                            <p className="text-[11px] font-semibold">{option.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {needsKanbanTarget ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">Cible kanban</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/[0.06] bg-[#181818] px-3 py-2.5">
                          {loadingBoards ? (
                            <p className="text-[13px] text-white/35">Chargement...</p>
                          ) : (
                            <select
                              value={boardId}
                              onChange={(event) => setBoardId(event.target.value)}
                              className="w-full bg-transparent text-[13px] text-white outline-none"
                            >
                              <option value="" className="bg-[#181818] text-white/50">Choisir un tableau</option>
                              {boards.map((board) => (
                                <option key={board.id} value={board.id} className="bg-[#181818] text-white">
                                  {board.title}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="rounded-2xl border border-white/[0.06] bg-[#181818] px-3 py-2.5">
                          {loadingColumns ? (
                            <p className="text-[13px] text-white/35">Chargement...</p>
                          ) : (
                            <select
                              value={columnId}
                              onChange={(event) => setColumnId(event.target.value)}
                              className="w-full bg-transparent text-[13px] text-white outline-none"
                            >
                              <option value="" className="bg-[#181818] text-white/50">Choisir une colonne</option>
                              {columns.map((column) => (
                                <option key={column.id} value={column.id} className="bg-[#181818] text-white">
                                  {column.title}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label htmlFor="organizer-title" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                      Intitulé
                    </label>
                    <input
                      id="organizer-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Ex. relancer sur la formule"
                      className="w-full rounded-2xl border border-white/[0.06] bg-[#181818] px-3 py-2.5 text-[13px] text-white placeholder:text-white/22 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <label htmlFor="organizer-date" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                        {usesAgenda ? "Date agenda" : "Échéance"}
                      </label>
                      <input
                        id="organizer-date"
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        className="w-full rounded-2xl border border-white/[0.06] bg-[#181818] px-3 py-2.5 text-[13px] text-white outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="organizer-time" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                        Heure
                      </label>
                      <input
                        id="organizer-time"
                        type="time"
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                        className="w-full rounded-2xl border border-white/[0.06] bg-[#181818] px-3 py-2.5 text-[13px] text-white outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="organizer-priority" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                        Importance
                      </label>
                      <select
                        id="organizer-priority"
                        value={priority}
                        onChange={(event) => setPriority(event.target.value as "high" | "medium" | "low")}
                        className="w-full rounded-2xl border border-white/[0.06] bg-[#181818] px-3 py-2.5 text-[13px] text-white outline-none"
                      >
                        {PRIORITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} className="bg-[#181818] text-white">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {usesAgenda ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setAlertEnabled((prev) => !prev)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-all ${
                          alertEnabled
                            ? "border-[#1f8a65]/70 bg-[#1f8a65]/12 text-white"
                            : "border-white/[0.06] bg-[#181818] text-white/55 hover:text-white/80"
                        }`}
                      >
                        <div>
                          <p className="text-[11px] font-semibold">Activer une alerte</p>
                          <p className="mt-1 text-[10px] leading-relaxed text-white/42">
                            L’alerte est indépendante de la date de l’événement.
                          </p>
                        </div>
                        <div className={`h-5 w-9 rounded-full p-0.5 transition-all ${alertEnabled ? "bg-[#1f8a65]" : "bg-white/[0.08]"}`}>
                          <div className={`h-4 w-4 rounded-full bg-white transition-transform ${alertEnabled ? "translate-x-4" : "translate-x-0"}`} />
                        </div>
                      </button>

                      {alertEnabled ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label htmlFor="organizer-alert-date" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                              Date alerte
                            </label>
                            <input
                              id="organizer-alert-date"
                              type="date"
                              value={alertDate}
                              onChange={(event) => setAlertDate(event.target.value)}
                              className="w-full rounded-2xl border border-white/[0.06] bg-[#181818] px-3 py-2.5 text-[13px] text-white outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="organizer-alert-time" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                              Heure alerte
                            </label>
                            <input
                              id="organizer-alert-time"
                              type="time"
                              value={alertTime}
                              onChange={(event) => setAlertTime(event.target.value)}
                              className="w-full rounded-2xl border border-white/[0.06] bg-[#181818] px-3 py-2.5 text-[13px] text-white outline-none"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label htmlFor="organizer-note" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
                      Contexte
                    </label>
                    <textarea
                      id="organizer-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={4}
                      placeholder="Préciser ce qui doit être traité."
                      className="w-full resize-none rounded-2xl border border-white/[0.06] bg-[#181818] px-3 py-3 text-[13px] text-white placeholder:text-white/22 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!clientId || submitting || (needsKanbanTarget && (!boardId || !columnId))}
                    className={`flex w-full items-center justify-center rounded-2xl px-4 py-3 text-[12px] font-semibold transition-all ${
                      !clientId || submitting || (needsKanbanTarget && (!boardId || !columnId))
                        ? "cursor-not-allowed bg-white/[0.06] text-white/28"
                        : "bg-[#1f8a65] text-white hover:bg-[#237b5f]"
                    }`}
                  >
                    {submitting ? "Enregistrement..." : "Créer l'action"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {helpOpen ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
              <button
                type="button"
                aria-label="Fermer l'aide"
                className="absolute inset-0 bg-black/60"
                onClick={() => setHelpOpen(false)}
              />
              <div className="relative w-full max-w-[26rem] rounded-[24px] border-[0.3px] border-white/[0.06] bg-[#181818] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[14px] font-semibold text-white">{helpContent.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/58">{helpContent.intro}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHelpOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/35 transition-all hover:bg-white/[0.06] hover:text-white/80"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {helpContent.items.map((item) => (
                    <div key={item} className="rounded-2xl border border-white/[0.06] bg-[#121212] px-3 py-2.5 text-[11px] leading-relaxed text-white/72">
                      {item}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[10.5px] leading-relaxed text-white/45">{helpContent.footer}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
