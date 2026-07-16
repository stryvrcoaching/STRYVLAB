"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic,
  X,
  Trash2,
  ChevronRight,
  Plus,
  RotateCcw,
  Keyboard,
  Loader2,
} from "lucide-react";
import { useClientT } from "@/components/client/ClientI18nProvider";
import useBodyScrollLock from "@/components/client/useBodyScrollLock";
import {
  cleanTranscript,
  guessVoiceFoodCategory,
  type VoiceItem,
} from "@/lib/nutrition/voice";
import type { NutritionParseSnapshot } from "@/lib/nutrition/parse-feedback";
import type {
  CategoryL1,
  EntryDraft,
  FoodItem,
  MealType,
} from "@/lib/nutrition/food-items";
import { sendClientMutation } from "@/lib/client/offline-mutations";

type Layer =
  | "recording"
  | "transcribing"
  | "transcript"
  | "processing"
  | "review";
type RecordMode = "idle" | "recording";
type EntryInputMode = "voice" | "text";
type VoicePurpose = "meal" | "note";
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const SUBCATEGORIES: Record<CategoryL1, string[]> = {
  proteins: [
    "viandes",
    "poissons",
    "oeufs",
    "laitiers",
    "vegetales",
    "complements",
  ],
  carbs: ["cereales", "fecules", "pain", "legumineuses"],
  vegetables: ["feuilles", "cruciferes", "autres-legumes"],
  fruits: ["frais", "secs"],
  fats: ["huiles", "noix-graines", "autres-lipides"],
  drinks: [
    "eau",
    "chauds",
    "jus-smoothies",
    "laits-vegetaux",
    "sports-drinks",
    "alcools",
  ],
  extras: [
    "sauces",
    "boissons",
    "snacks-sales",
    "snacks-sucres",
    "fast-food",
    "divers",
  ],
};

// Extends VoiceItem with per-gram nutritional bases for correct quantity recalculation
type DisplayItem = VoiceItem & {
  _kcal_per_g: number;
  _protein_per_g: number;
  _carbs_per_g: number;
  _fat_per_g: number;
  _fiber_per_g: number;
};

function withBases(item: VoiceItem): DisplayItem {
  const q = item.quantity_g > 0 ? item.quantity_g : 1;
  const guessedCategory =
    item.category_l1 && item.category_l2
      ? { category_l1: item.category_l1, category_l2: item.category_l2 }
      : guessVoiceFoodCategory(item.name);
  return {
    ...item,
    _kcal_per_g: item.kcal / q,
    _protein_per_g: item.protein_g / q,
    _carbs_per_g: item.carbs_g / q,
    _fat_per_g: item.fat_g / q,
    _fiber_per_g: item.fiber_g / q,
    category_l1: item.category_l1 ?? guessedCategory?.category_l1,
    category_l2: item.category_l2 ?? guessedCategory?.category_l2,
  };
}

function toParseSnapshot(items: DisplayItem[], mealType: MealType): NutritionParseSnapshot {
  return {
    meal_type: mealType,
    items: items
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        name: item.name.trim(),
        quantity_g: item.quantity_g,
        food_item_id: item.food_item_id ?? null,
        category_l1: item.category_l1 ?? null,
        category_l2: item.category_l2 ?? null,
      })),
  };
}

function snapshotsDiffer(
  initialSnapshot: NutritionParseSnapshot | null,
  currentSnapshot: NutritionParseSnapshot,
): boolean {
  if (!initialSnapshot) return false;
  return JSON.stringify(initialSnapshot) !== JSON.stringify(currentSnapshot);
}

interface VoiceLogSheetProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onTranscriptOnly?: (transcript: string) => void;
  onDraftReady?: (entries: EntryDraft[], mealType: MealType) => void;
  onNoteSubmit?: (note: string) => void;
  mealId?: string;
  lang?: string;
  initialInputMode?: EntryInputMode;
  initialText?: string;
  purpose?: VoicePurpose;
  onNoteDraftChange?: (note: string) => void;
}

const MAX_RECORD_SEC = 90;

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-white/[0.06] text-[#b0b0b0]",
  medium: "bg-white/[0.06] text-[#b0b0b0]",
  low: "bg-white/[0.06] text-[#b0b0b0]",
};

function appendDictation(base: string, addition: string) {
  const cleanBase = base.trim();
  const cleanAddition = addition.trim();

  if (!cleanAddition) {
    return base;
  }

  if (!cleanBase) {
    return cleanAddition;
  }

  const separator = /[.!?…]$/.test(cleanBase) ? " " : ". ";
  return `${cleanBase}${separator}${cleanAddition}`;
}

export default function VoiceLogSheet({
  open,
  onClose,
  onSuccess,
  onTranscriptOnly,
  onDraftReady,
  onNoteSubmit,
  mealId,
  lang = "fr",
  initialInputMode = "voice",
  initialText = "",
  purpose = "meal",
  onNoteDraftChange,
}: VoiceLogSheetProps) {
  const { t } = useClientT();
  useBodyScrollLock(open);
  const isNoteMode = purpose === "note";
  const sheetTitle = isNoteMode ? t("voice.note.title") : t("voice.title");

  const CATEGORY_LABELS_T: Record<CategoryL1, string> = {
    proteins: t("food.cat.proteins"),
    carbs: t("food.cat.carbs"),
    vegetables: t("food.cat.vegetables"),
    fruits: t("food.cat.fruits"),
    fats: t("food.cat.fats"),
    drinks: t("food.cat.drinks"),
    extras: t("food.cat.extras"),
  };
  const SUBCATEGORY_LABELS_T: Record<string, string> = {
    viandes: t("food.sub.viandes"),
    poissons: t("food.sub.poissons"),
    oeufs: t("food.sub.oeufs"),
    laitiers: t("food.sub.laitiers"),
    vegetales: t("food.sub.vegetales"),
    complements: t("food.sub.complements"),
    cereales: t("food.sub.cereales"),
    fecules: t("food.sub.fecules"),
    pain: t("food.sub.pain"),
    legumineuses: t("food.sub.legumineuses"),
    feuilles: t("food.sub.feuilles"),
    cruciferes: t("food.sub.cruciferes"),
    "autres-legumes": t("food.sub.autres-legumes"),
    frais: t("food.sub.frais"),
    secs: t("food.sub.secs"),
    huiles: t("food.sub.huiles"),
    "noix-graines": t("food.sub.noix-graines"),
    "autres-lipides": t("food.sub.autres-lipides"),
    sauces: t("food.sub.sauces"),
    boissons: t("food.sub.boissons"),
    divers: t("food.sub.divers"),
    "snacks-sales": t("food.sub.snacks-sales"),
    "snacks-sucres": t("food.sub.snacks-sucres"),
    "fast-food": t("food.sub.fast-food"),
    eau: t("food.sub.eau"),
    chauds: t("food.sub.chauds"),
    "jus-smoothies": t("food.sub.jus-smoothies"),
    "laits-vegetaux": t("food.sub.laits-vegetaux"),
    "sports-drinks": t("food.sub.sports-drinks"),
    alcools: t("food.sub.alcools"),
  };

  const [layer, setLayer] = useState<Layer>("recording");
  const [mode, setMode] = useState<RecordMode>("idle");
  const [inputMode, setInputMode] = useState<EntryInputMode>("voice");
  const [textInput, setTextInput] = useState("");
  const [editableTranscript, setEditableTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [qtyDrafts, setQtyDrafts] = useState<Record<number, string>>({});
  const [mealType, setMealType] = useState<MealType>("snack");
  const [initialParseSnapshot, setInitialParseSnapshot] =
    useState<NutritionParseSnapshot | null>(null);
  const [logging, setLogging] = useState(false);
  const [waveBars, setWaveBars] = useState<number[]>([6, 6, 6, 6, 6, 6, 6]);
  const [elapsedSec, setElapsedSec] = useState(0);

  const closeNoteSheet = useCallback(() => {
    if (isNoteMode) {
      onNoteDraftChange?.(textInput.trim());
    }
    onClose();
  }, [isNoteMode, onClose, onNoteDraftChange, textInput]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm;codecs=opus");
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveFrameRef = useRef<number | null>(null);
  const modeRef = useRef<RecordMode>("idle");
  const openRef = useRef(open);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationBaseRef = useRef("");

  openRef.current = open;
  function setModeSync(m: RecordMode) {
    modeRef.current = m;
    setMode(m);
  }
  const isActive = mode === "recording";

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setLayer("recording");
      setModeSync("idle");
      setInputMode(initialInputMode);
      setTextInput(initialText);
      setEditableTranscript(initialText);
      setError(null);
      setItems([]);
      setInitialParseSnapshot(null);
      setElapsedSec(0);
      setWaveBars([6, 6, 6, 6, 6, 6, 6]);
      chunksRef.current = [];
      dictationBaseRef.current = initialText;
    } else {
      stopAll();
      setModeSync("idle");
    }
  }, [open, initialInputMode, initialText]);

  useEffect(() => () => stopAll(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setQtyDrafts({});
  }, [items.length]);

  // ── Stop everything ────────────────────────────────────────────────────────
  function stopAll() {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.abort();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (waveFrameRef.current) {
      cancelAnimationFrame(waveFrameRef.current);
      waveFrameRef.current = null;
    }
    if (recorderRef.current) {
      try {
        recorderRef.current.stop();
      } catch {}
      recorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    chunksRef.current = [];
  }

  // ── Waveform animation ─────────────────────────────────────────────────────
  function startWave() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    function frame() {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(buf);
      const bars = Array.from({ length: 7 }, (_, i) => {
        const slice = Array.from(buf.slice(i * 5, i * 5 + 5));
        const avg = slice.reduce((a, b) => a + b, 0) / 5;
        return Math.max(4, Math.min(40, Math.round(avg / 2.8)));
      });
      setWaveBars(bars);
      waveFrameRef.current = requestAnimationFrame(frame);
    }
    waveFrameRef.current = requestAnimationFrame(frame);
  }

  // ── Transcribe blob via Whisper ────────────────────────────────────────────
  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      if (!openRef.current) return;
      const ext = mimeTypeRef.current.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `audio.${ext}`, { type: blob.type });
      const form = new FormData();
      form.append("audio", file);
      try {
        const res = await fetch("/api/client/nutrition/voice-transcribe", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          setError(t("voice.error_parse"));
          setLayer("recording");
          setModeSync("idle");
          return;
        }
        const { transcript } = await res.json();
        if (!openRef.current) return;
        if (isNoteMode) {
          const next = appendDictation(dictationBaseRef.current, transcript);
          setTextInput(next);
          setEditableTranscript(next);
          setError(null);
          setModeSync("idle");
          setLayer("recording");
        } else if (onTranscriptOnly) {
          onTranscriptOnly(transcript);
        } else {
          setEditableTranscript(transcript);
          setLayer("transcript");
        }
      } catch {
        setError(t("voice.error_parse"));
        setLayer("recording");
        setModeSync("idle");
      }
    },
    [isNoteMode, t, onTranscriptOnly],
  );

  // ── Parse transcript → GPT ─────────────────────────────────────────────────
  const parseTranscript = useCallback(
    async (raw: string) => {
      if (!openRef.current) return;
      if (isNoteMode) {
        const note = cleanTranscript(raw, lang);
        if (note.length < 3) {
          setError(t("voice.error.noteShort"));
          return;
        }
        setError(null);
        onNoteSubmit?.(note);
        onTranscriptOnly?.(note);
        onClose();
        return;
      }
      const clean = cleanTranscript(raw, lang);
      setLayer("processing");
      setError(null);
      const today = new Date().toISOString().slice(0, 10);
      try {
        const res = await fetch("/api/client/nutrition/voice-parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: clean,
            physiological_date: today,
          }),
        });
        if (res.status === 429) {
          setError(t("voice.error_rate_limit"));
          setLayer("transcript");
          return;
        }
        if (!res.ok) {
          setError(t("voice.error_parse"));
          setLayer("transcript");
          return;
        }
        const data = await res.json();
        if (!openRef.current) return;
        const parsedItems = (data.items ?? []).map(withBases);
        const parsedMealType = data.meal_type ?? "snack";
        setItems(parsedItems);
        setMealType(parsedMealType);
        setInitialParseSnapshot(toParseSnapshot(parsedItems, parsedMealType));
        setLayer("review");
      } catch {
        setError(t("voice.error_parse"));
        setLayer("transcript");
      }
    },
    [isNoteMode, lang, onClose, onNoteSubmit, onTranscriptOnly, t],
  );

  // ── Stop recording → transcribing layer ───────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (waveFrameRef.current) {
      cancelAnimationFrame(waveFrameRef.current);
      waveFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    // recorder.stop() triggers onstop → transcribeBlob
    if (recorderRef.current) {
      try {
        recorderRef.current.stop();
      } catch {}
      recorderRef.current = null;
    }
    setWaveBars([6, 6, 6, 6, 6, 6, 6]);
    setModeSync("idle");
    setLayer("transcribing");
  }, []);

  useEffect(() => {
    function onHide() {
      if (modeRef.current === "recording") stopRecording();
    }
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [stopRecording]);

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (modeRef.current === "recording") return;
    const noteBaseText = textInput;
    dictationBaseRef.current = noteBaseText;
    setModeSync("recording");
    setError(null);
    setElapsedSec(0);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setModeSync("idle");
      setError(t("voice.error.microphone"));
      return;
    }

    if (!openRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      setModeSync("idle");
      return;
    }

    streamRef.current = stream;

    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      startWave();
    } catch {}

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/mp4";
    mimeTypeRef.current = mimeType;

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      transcribeBlob(blob);
    };
    recorderRef.current = recorder;
    recorder.start(250);

    timerRef.current = setInterval(() => {
      setElapsedSec((p) => {
        if (p + 1 >= MAX_RECORD_SEC) {
          stopRecording();
          return MAX_RECORD_SEC;
        }
        return p + 1;
      });
    }, 1000);

    maxTimerRef.current = setTimeout(
      () => {
        if (modeRef.current === "recording") stopRecording();
      },
      (MAX_RECORD_SEC + 2) * 1000,
    );
  }, [stopRecording, textInput, transcribeBlob]);

  function handleToggle() {
    if (modeRef.current === "idle") {
      startRecording();
    } else {
      stopRecording();
    }
  }

  function handleReRecord() {
    setEditableTranscript("");
    setError(null);
    setLayer("recording");
    setElapsedSec(0);
    chunksRef.current = [];
  }

  // ── Item editing ───────────────────────────────────────────────────────────
  function updateItem(index: number, field: keyof DisplayItem, value: any) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === "name") {
          const nextName = String(value);
          const guessed = guessVoiceFoodCategory(nextName);
          return {
            ...item,
            name: nextName,
            category_l1: item.category_l1 ?? guessed?.category_l1,
            category_l2: item.category_l2 ?? guessed?.category_l2,
          };
        }
        if (field === "category_l1") {
          const category = value as CategoryL1;
          return {
            ...item,
            category_l1: category,
            category_l2: SUBCATEGORIES[category][0] ?? "divers",
          };
        }
        if (field === "quantity_g") {
          const qty = value as number;
          return {
            ...item,
            quantity_g: qty,
            kcal: Math.round(item._kcal_per_g * qty),
            protein_g: parseFloat((item._protein_per_g * qty).toFixed(1)),
            carbs_g: parseFloat((item._carbs_per_g * qty).toFixed(1)),
            fat_g: parseFloat((item._fat_per_g * qty).toFixed(1)),
            fiber_g: parseFloat((item._fiber_per_g * qty).toFixed(1)),
          };
        }
        return { ...item, [field]: value };
      }),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addEmptyItem() {
    setItems((prev) => [
      ...prev,
      withBases({
        name: "",
        quantity_g: 100,
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        confidence: "low" as const,
        is_new: true,
      }),
    ]);
  }

  function toDraftFoodItem(item: DisplayItem): FoodItem {
    const guessed = guessVoiceFoodCategory(item.name);
    const quantity = item.quantity_g > 0 ? item.quantity_g : 100;
    return {
      id:
        item.food_item_id ??
        `voice-${item.name}-${quantity}`.toLowerCase().replace(/\s+/g, "-"),
      name_fr: item.name,
      category_l1: item.category_l1 ?? guessed?.category_l1 ?? "extras",
      category_l2: item.category_l2 ?? guessed?.category_l2 ?? "divers",
      item_key:
        item.food_item_id ??
        `voice-${item.name}`.toLowerCase().replace(/\s+/g, "-"),
      icon_key: null,
      kcal_per_100g: Math.round((item.kcal / quantity) * 100),
      protein_per_100g: parseFloat(
        ((item.protein_g / quantity) * 100).toFixed(1),
      ),
      carbs_per_100g: parseFloat(((item.carbs_g / quantity) * 100).toFixed(1)),
      fat_per_100g: parseFloat(((item.fat_g / quantity) * 100).toFixed(1)),
      fiber_per_100g: parseFloat(((item.fiber_g / quantity) * 100).toFixed(1)),
      source: item.is_new ? "user" : "catalog",
      is_verified: !item.is_new,
    };
  }

  async function resolveDraftEntriesFromItems(
    validItems: DisplayItem[],
  ): Promise<EntryDraft[] | null> {
    const uncategorizedNewItem = validItems.find(
      (i) => i.is_new && !i.food_item_id && (!i.category_l1 || !i.category_l2),
    );
    if (uncategorizedNewItem) {
      setError(t("voice.error.category"));
      return null;
    }

    for (const item of validItems.filter((i) => i.is_new && !i.food_item_id)) {
      try {
        const per100 =
          item.quantity_g > 0
            ? {
                kcal_per_100g: Math.round((item.kcal / item.quantity_g) * 100),
                protein_per_100g: parseFloat(
                  ((item.protein_g / item.quantity_g) * 100).toFixed(1),
                ),
                carbs_per_100g: parseFloat(
                  ((item.carbs_g / item.quantity_g) * 100).toFixed(1),
                ),
                fat_per_100g: parseFloat(
                  ((item.fat_g / item.quantity_g) * 100).toFixed(1),
                ),
                fiber_per_100g: parseFloat(
                  ((item.fiber_g / item.quantity_g) * 100).toFixed(1),
                ),
              }
            : {
                kcal_per_100g: item.kcal,
                protein_per_100g: item.protein_g,
                carbs_per_100g: item.carbs_g,
                fat_per_100g: item.fat_g,
                fiber_per_100g: item.fiber_g,
              };
        const res = await fetch("/api/client/food-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name_fr: item.name,
            category_l1: item.category_l1,
            category_l2: item.category_l2,
            ...per100,
          }),
        });
        if (res.ok) {
          const c = await res.json();
          item.food_item_id = c.data?.id ?? c.id;
          item.is_new = false;
        }
      } catch {}
    }

    return validItems.map((item) => ({
      food_item: toDraftFoodItem(item),
      quantity_g: item.quantity_g,
      input_mode: inputMode,
    }));
  }

  // ── Log meal ───────────────────────────────────────────────────────────────
  async function logMeal() {
    const validItems = items.filter((i) => i.name.trim().length > 0);
    if (validItems.length === 0) return;
    setLogging(true);
    const draftEntries = await resolveDraftEntriesFromItems(validItems);
    if (!draftEntries) {
      setLogging(false);
      return;
    }
    const correctedSnapshot = toParseSnapshot(validItems, mealType);
    if (onDraftReady) {
      if (snapshotsDiffer(initialParseSnapshot, correctedSnapshot)) {
        try {
          await fetch("/api/client/nutrition/parse-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: inputMode,
              transcript: editableTranscript.trim(),
              meal_type: mealType,
              parsed: initialParseSnapshot,
              corrected: correctedSnapshot,
            }),
          });
        } catch {}
      }
      onDraftReady(draftEntries, mealType);
      setLogging(false);
      onClose();
      return;
    }
    const entries = validItems
      .filter((i) => i.food_item_id)
      .map((i) => ({
        food_item_id: i.food_item_id!,
        quantity_g: i.quantity_g,
        input_mode: inputMode,
      }));
    if (entries.length === 0) {
      setLogging(false);
      setError(t("voice.error_parse"));
      return;
    }
    try {
      const result = await sendClientMutation({
        kind: "meal",
        url: "/api/client/nutrition/meals",
        method: "POST",
        body: {
          ...(mealId ? { meal_id: mealId } : {}),
          meal_type: mealType,
          meal_source: inputMode === "text" ? "text" : "voice",
          entries,
        },
      });
      if (!result.queued && !result.response?.ok) throw new Error();
      const loggedMeal = await result.response?.json();
      if (snapshotsDiffer(initialParseSnapshot, correctedSnapshot)) {
        try {
          await fetch("/api/client/nutrition/parse-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              meal_id: loggedMeal?.id ?? null,
              source: inputMode,
              transcript: editableTranscript.trim(),
              meal_type: mealType,
              parsed: initialParseSnapshot,
              corrected: correctedSnapshot,
            }),
          });
        } catch {}
      }
      if (onSuccess) onSuccess();
      else onClose();
    } catch {
      setError(t("voice.error_parse"));
    } finally {
      setLogging(false);
    }
  }

  const totalKcal = items.reduce((s, i) => s + i.kcal, 0);
  const totalP = items.reduce((s, i) => s + i.protein_g, 0);
  const totalC = items.reduce((s, i) => s + i.carbs_g, 0);
  const totalF = items.reduce((s, i) => s + i.fat_g, 0);
  const newCount = items.filter((i) => i.is_new).length;
  const uncategorizedCount = items.filter(
    (i) => i.is_new && !i.food_item_id && (!i.category_l1 || !i.category_l2),
  ).length;
  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const timeWarning = isActive && elapsedSec >= 70;
  const noteIsTranscribing = isNoteMode && layer === "transcribing";

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeNoteSheet}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl"
            style={{
              background: "#0d0d0d",
              maxHeight: "var(--client-sheet-max-height)",
              display: "flex",
              flexDirection: "column",
              paddingBottom: "16px",
            }}
            initial={{ y: "100%" }}
            animate={{
              y: 0,
              transition: { type: "spring", stiffness: 300, damping: 30 },
            }}
            exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.10]" />
              <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
                {sheetTitle}
              </p>
              <button
                onClick={closeNoteSheet}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-8">
              {isNoteMode ? (
                <div className="flex flex-col gap-4 pt-1">
                  <div>
                    <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/40">
                      {t("voice.note.prompt")}
                    </p>
                    <p className="mt-2 text-[13px] leading-6 text-white/62">
                      {t("voice.note.desc")}
                    </p>
                  </div>

                  <div className="relative rounded-[20px] bg-white/[0.05] p-3 ring-1 ring-white/[0.08]">
                    {isActive || noteIsTranscribing ? (
                      <div className="flex min-h-[150px] flex-col items-center justify-center gap-4 rounded-[16px] py-4">
                        <div className="flex h-12 items-center justify-center gap-[4px]">
                          {waveBars.map((h, i) => (
                            <motion.div
                              key={i}
                              style={{
                                width: 4,
                                borderRadius: 99,
                                backgroundColor: isActive ? "#f2f2f2" : "#3a3a3a",
                              }}
                              animate={{ height: isActive ? h : 8 }}
                              transition={{ type: "spring", stiffness: 500, damping: 28 }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/44">
                          {noteIsTranscribing ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              {t("voice.transcribing")}
                            </>
                          ) : (
                            <>
                              {t("voice.note.recording")}
                              <span className="tabular-nums text-white/70">{formatTime(elapsedSec)}</span>
                            </>
                          )}
                        </div>
                        {isActive ? (
                          <button
                            onClick={handleToggle}
                            className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-[#080808] transition active:scale-95"
                            aria-label={t("voice.aria.stopNoteRecording")}
                          >
                            <span className="h-4 w-4 rounded-[3px] bg-[#080808]" />
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <textarea
                          autoFocus
                          value={textInput}
                          onChange={(e) => {
                            setTextInput(e.target.value)
                            setEditableTranscript(e.target.value)
                          }}
                          rows={5}
                          placeholder={t("voice.note.placeholder")}
                          className="w-full min-w-0 rounded-[16px] bg-transparent pr-14 py-2 text-[15px] leading-6 text-white/90 outline-none resize-none placeholder:text-white/28"
                        />
                        <button
                          onClick={handleToggle}
                          className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#1a1a1a] text-white/76 transition-all"
                          aria-label={t("voice.aria.startNoteRecording")}
                        >
                          <Mic size={16} />
                        </button>
                      </>
                    )}
                  </div>

                  {error ? <p className="text-[12px] text-red-400">{error}</p> : null}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={closeNoteSheet}
                      className="h-12 flex-1 rounded-[16px] bg-white/[0.06] text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/68"
                    >
                      {t("voice.note.close")}
                    </button>
                    <button
                      onClick={() => {
                        setError(null)
                        void parseTranscript(textInput)
                      }}
                      disabled={textInput.trim().length < 3 || isActive || noteIsTranscribing}
                      className="h-12 flex-[1.4] rounded-[16px] bg-white text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[#080808] disabled:opacity-40"
                    >
                      {t("voice.note.add")}
                    </button>
                  </div>
                </div>
              ) : null}
              {/* ── LAYER: recording ── */}
              {!isNoteMode && layer === "recording" && (
                <div
                  className="flex flex-col"
                  style={{ paddingTop: 4, paddingBottom: 16, gap: 0 }}
                >
                  {/* Mode toggle */}
                  <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1 mb-5">
                    <button
                      onClick={() => setInputMode("voice")}
                      className={`flex-1 h-8 flex items-center justify-center gap-1.5 rounded-xl text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] transition-all ${
                        inputMode === "voice"
                          ? "bg-white/[0.10] text-white"
                          : "text-white/30 hover:text-white/50"
                      }`}
                      >
                      <Mic size={12} />
                      {t("voice.mode.voice")}
                    </button>
                    <button
                      onClick={() => setInputMode("text")}
                      className={`flex-1 h-8 flex items-center justify-center gap-1.5 rounded-xl text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] transition-all ${
                        inputMode === "text"
                          ? "bg-white/[0.10] text-white"
                          : "text-white/30 hover:text-white/50"
                      }`}
                    >
                      <Keyboard size={12} />
                      {t("voice.mode.text")}
                    </button>
                  </div>

                  {/* ── Voice sub-panel ── */}
                  {inputMode === "voice" && (
                    <div
                      className="flex flex-col items-center"
                      style={{ gap: 0 }}
                    >
                      {/* Waveform */}
                      <div
                        className="flex items-center justify-center gap-[4px]"
                        style={{ height: 44, marginBottom: 10 }}
                      >
                        {waveBars.map((h, i) => (
                          <motion.div
                            key={i}
                            style={{
                              width: 4,
                              borderRadius: 99,
                              backgroundColor: isActive ? "#f2f2f2" : "#2e2e2e",
                            }}
                            animate={{ height: isActive ? h : 4 }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 28,
                            }}
                          />
                        ))}
                      </div>

                      {/* Timer */}
                      <span
                        className="tabular-nums font-barlow-condensed font-bold tracking-[0.16em]"
                        style={{
                          fontSize: 12,
                          color: timeWarning
                            ? "#b0b0b0"
                            : isActive
                              ? "#f2f2f2"
                              : "#5a5a5a",
                          marginBottom: 14,
                        }}
                      >
                        {formatTime(elapsedSec)}
                        {timeWarning && ` / ${formatTime(MAX_RECORD_SEC)}`}
                      </span>

                      {/* Spacer */}
                      <div style={{ height: 52, marginBottom: 24 }} />

                      {error && (
                        <p
                          className="text-[12px] text-red-400 text-center"
                          style={{ marginBottom: 16 }}
                        >
                          {error}
                        </p>
                      )}

                      {/* Mic button */}
                      <div style={{ marginBottom: 20 }}>
                        <button
                          onClick={handleToggle}
                          className="flex flex-col items-center justify-center select-none"
                          style={{
                            width: 88,
                            height: 88,
                            borderRadius: 22,
                            gap: 5,
                            background: isActive ? "#222222" : "#f2f2f2",
                            border: "none",
                          }}
                        >
                          <Mic
                            size={28}
                            strokeWidth={2}
                            style={{ color: isActive ? "#f2f2f2" : "#080808" }}
                          />
                          <span
                            style={{
                              fontSize: 8,
                              fontFamily: "var(--font-barlow-condensed)",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.14em",
                              lineHeight: 1,
                              color: isActive ? "#f2f2f2" : "#080808",
                            }}
                          >
                            {isActive ? t("voice.record.stop") : t("voice.record.start")}
                          </span>
                        </button>
                      </div>

                      <p
                        className="font-barlow-condensed font-bold uppercase text-center"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.16em",
                          color: "rgba(255,255,255,0.18)",
                          lineHeight: 1.4,
                        }}
                      >
                        {isActive
                          ? t("voice.record.tapStop")
                          : t("voice.record.tapStart")}
                      </p>
                    </div>
                  )}

                  {/* ── Text sub-panel ── */}
                  {inputMode === "text" && (
                    <div className="flex flex-col gap-4">
                      <textarea
                        autoFocus
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        rows={5}
                        placeholder={
                          t("voice.text.placeholder")
                        }
                        className="w-full min-w-0 rounded-xl px-4 py-3 text-white/90 leading-relaxed resize-none focus:outline-none"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          fontSize: 16,
                        }}
                      />
                      {error && (
                        <p className="text-[12px] text-red-400">{error}</p>
                      )}
                      <button
                        onClick={() => {
                          setError(null);
                          parseTranscript(textInput);
                        }}
                        disabled={textInput.trim().length < 3}
                        className="w-full h-12 flex items-center justify-center gap-2 rounded-xl font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[12px] transition-all active:scale-[0.98] disabled:opacity-40"
                        style={{ background: "#f2f2f2", color: "#080808" }}
                      >
                        <ChevronRight size={16} />
                        {isNoteMode ? t("voice.action.apply") : t("voice.action.continue")}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── LAYER: transcribing ── */}
              {!isNoteMode && layer === "transcribing" && (
                <div className="flex flex-col items-center justify-center h-48 gap-5">
                  <div className="h-10 w-10 border-2 border-[#2e2e2e] border-t-[#f2f2f2] rounded-full animate-spin" />
                  <p className="text-[13px] text-white/50 font-barlow-condensed uppercase tracking-[0.14em]">
                    {t("voice.transcribing")}
                  </p>
                </div>
              )}

              {/* ── LAYER: transcript — editable before analysis ── */}
              {!isNoteMode && layer === "transcript" && (
                <div className="flex flex-col gap-4" style={{ paddingTop: 4 }}>
                  <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/40">
                    {t("voice.review.check")}
                  </p>

                  <textarea
                    value={editableTranscript}
                    onChange={(e) => setEditableTranscript(e.target.value)}
                    rows={5}
                    placeholder={t("voice.transcript.placeholder")}
                    className="w-full min-w-0 rounded-xl px-4 py-3 text-white/90 leading-relaxed resize-none focus:outline-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontSize: 16,
                    }}
                  />

                  {error && <p className="text-[12px] text-red-400">{error}</p>}

                  <div className="flex gap-3">
                    {/* Re-record */}
                    <button
                      onClick={handleReRecord}
                      className="h-12 flex-1 flex items-center justify-center gap-2 rounded-xl font-barlow-condensed font-bold uppercase tracking-[0.08em] text-[11px] transition-all active:scale-[0.98] whitespace-nowrap"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: "rgba(255,255,255,0.5)",
                      }}
                    >
                      <RotateCcw size={13} />
                      {t("voice.rerecord")}
                    </button>

                    {/* Analyse */}
                    <button
                      onClick={() => parseTranscript(editableTranscript)}
                      disabled={editableTranscript.trim().length < 3}
                      className="h-12 flex-[1.4] flex items-center justify-center gap-2 rounded-xl font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[12px] transition-all active:scale-[0.98] disabled:opacity-40"
                      style={{ background: "#f2f2f2", color: "#080808" }}
                    >
                      <ChevronRight size={16} />
                      {isNoteMode ? t("voice.action.apply") : t("voice.action.continue")}
                    </button>
                  </div>
                </div>
              )}

              {/* ── LAYER: processing ── */}
              {!isNoteMode && layer === "processing" && (
                <div className="flex flex-col items-center justify-center h-48 gap-5">
                  <div className="h-10 w-10 border-2 border-[#2e2e2e] border-t-[#f2f2f2] rounded-full animate-spin" />
                  <p className="text-[13px] text-white/50 font-barlow-condensed uppercase tracking-[0.14em]">
                    {t("voice.processing")}
                  </p>
                </div>
              )}

              {/* ── LAYER: review ── */}
              {!isNoteMode && layer === "review" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/40 mt-1">
                    {t("voice.review_title")}
                  </p>

                  {items.map((item, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      className="rounded-xl p-3"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <input
                          value={item.name}
                          onChange={(e) =>
                            updateItem(idx, "name", e.target.value)
                          }
                          className="flex-1 min-w-0 bg-transparent text-[13px] text-white pb-0.5 focus:outline-none border-b border-[#2e2e2e]"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-lg ${CONFIDENCE_STYLES[item.confidence] ?? CONFIDENCE_STYLES.medium}`}
                          >
                            {t(
                              item.confidence === "high"
                                ? "voice.confidence_high"
                                : item.confidence === "medium"
                                  ? "voice.confidence_med"
                                  : "voice.confidence_low",
                            )}
                          </span>
                          {item.is_new && (
                            <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-lg bg-white/[0.06] text-[#b0b0b0]">
                              {t("voice.new_badge")}
                            </span>
                          )}
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-white/30 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              qtyDrafts[idx] !== undefined
                                ? qtyDrafts[idx]
                                : String(item.quantity_g)
                            }
                            onChange={(e) =>
                              setQtyDrafts((prev) => ({
                                ...prev,
                                [idx]: e.target.value,
                              }))
                            }
                            onFocus={(e) => {
                              setQtyDrafts((prev) => ({
                                ...prev,
                                [idx]: String(item.quantity_g),
                              }));
                              e.target.select();
                            }}
                            onBlur={() => {
                              const raw = qtyDrafts[idx];
                              if (raw !== undefined) {
                                const v = parseFloat(raw);
                                if (isFinite(v) && v >= 0) {
                                  if (v === 0) {
                                    // Remove item when quantity reaches 0
                                    removeItem(idx);
                                  } else {
                                    updateItem(idx, "quantity_g", v);
                                  }
                                }
                                setQtyDrafts((prev) => {
                                  const n = { ...prev };
                                  delete n[idx];
                                  return n;
                                });
                              }
                            }}
                            className="w-16 min-w-0 bg-white/[0.06] rounded-lg px-2 py-1 text-[12px] text-white text-center focus:outline-none"
                          />
                          <span className="text-[11px] text-white/40">g</span>
                        </div>
                        <span className="text-[11px] text-white/60">
                          {Math.round(item.kcal)} kcal
                        </span>
                        <span className="text-[11px] text-white/40">
                          P {item.protein_g.toFixed(1)}g
                        </span>
                        <span className="text-[11px] text-white/40">
                          G {item.carbs_g.toFixed(1)}g
                        </span>
                        <span className="text-[11px] text-white/40">
                          L {item.fat_g.toFixed(1)}g
                        </span>
                      </div>
                      {item.is_new && !item.food_item_id && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-white/25 font-semibold">
                              {t("log.custom.category")}
                            </p>
                            <select
                              value={item.category_l1 ?? ""}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "category_l1",
                                  e.target.value as CategoryL1,
                                )
                              }
                              className="w-full h-9 px-3 bg-white/[0.06] rounded-xl text-[12px] text-white outline-none"
                            >
                              <option
                                value=""
                                className="bg-[#080808] text-white"
                              >
                                {t("common.select")}
                              </option>
                              {(
                                Object.entries(CATEGORY_LABELS_T) as [
                                  CategoryL1,
                                  string,
                                ][]
                              ).map(([value, label]) => (
                                <option
                                  key={value}
                                  value={value}
                                  className="bg-[#080808] text-white"
                                >
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-white/25 font-semibold">
                              {t("log.custom.subcategory")}
                            </p>
                            <select
                              value={item.category_l2 ?? ""}
                              onChange={(e) =>
                                updateItem(idx, "category_l2", e.target.value)
                              }
                              disabled={!item.category_l1}
                              className="w-full h-9 px-3 bg-white/[0.06] rounded-xl text-[12px] text-white outline-none disabled:opacity-40"
                            >
                              <option
                                value=""
                                className="bg-[#080808] text-white"
                              >
                                {t("common.select")}
                              </option>
                              {(item.category_l1
                                ? SUBCATEGORIES[item.category_l1]
                                : []
                              ).map((value) => (
                                <option
                                  key={value}
                                  value={value}
                                  className="bg-[#080808] text-white"
                                >
                                  {SUBCATEGORY_LABELS_T[value] ?? value}
                                </option>
                              ))}
                            </select>
                          </div>
                          <p className="col-span-2 text-[11px] text-white/40">
                            {item.category_l1 && item.category_l2
                              ? t("voice.review.classification", {
                                  category: CATEGORY_LABELS_T[item.category_l1],
                                  subcategory: SUBCATEGORY_LABELS_T[item.category_l2] ?? item.category_l2,
                                })
                              : t("voice.review.classificationMissing")}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ))}

                  <button
                    onClick={addEmptyItem}
                    className="flex items-center gap-2 text-[12px] text-white/40 hover:text-white/60 transition-colors py-2"
                  >
                    <Plus size={14} />
                    {t("voice.add_item")}
                  </button>

                  {newCount > 0 && (
                    <p className="text-[11px] text-[#808080]">
                      {t("voice.new_items_notice").replace(
                        "{n}",
                        String(newCount),
                      )}
                    </p>
                  )}
                  {uncategorizedCount > 0 && (
                    <p className="text-[11px] text-[#b0b0b0]">
                      {(t("voice.review.uncategorizedCount", {
                        n: uncategorizedCount,
                      }) || "")
                        .split("|")[uncategorizedCount > 1 ? 1 : 0]
                        ?.replace("{n}", String(uncategorizedCount))}
                    </p>
                  )}

                  <div
                    className="rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    <span className="text-[13px] font-bold text-white">
                      {Math.round(totalKcal)} kcal
                    </span>
                    <div className="flex gap-3 text-[11px] text-white/50">
                      <span>P {totalP.toFixed(1)}g</span>
                      <span>G {totalC.toFixed(1)}g</span>
                      <span>L {totalF.toFixed(1)}g</span>
                    </div>
                  </div>

                  {error && <p className="text-[12px] text-red-400">{error}</p>}

                  <button
                    onClick={logMeal}
                    disabled={
                      logging ||
                      items.filter((i) => i.name.trim()).length === 0 ||
                      uncategorizedCount > 0
                    }
                    className="w-full h-12 rounded-xl font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                    style={{ background: "#f2f2f2", color: "#080808" }}
                  >
                    {logging ? (
                      <div className="h-4 w-4 border-2 border-[#080808]/30 border-t-[#080808] rounded-full animate-spin" />
                    ) : (
                      <>
                        <ChevronRight size={16} />
                        {onDraftReady
                          ? t("voice.action.addToDraft")
                          : t("voice.log_meal")}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
