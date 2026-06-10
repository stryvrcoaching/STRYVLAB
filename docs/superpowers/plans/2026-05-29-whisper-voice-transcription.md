# Whisper Voice Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser SpeechRecognition with OpenAI Whisper in the voice nutrition logger, fixing homophone errors ("oui" → "whey", "Prouti Muscle" → "Nutri Muscle") via a sports nutrition vocabulary prompt.

**Architecture:** `MediaRecorder` captures audio blob client-side → `POST /api/client/nutrition/voice-transcribe` sends blob to Whisper API with a sports nutrition `prompt` hint → transcript returned → existing editable transcript layer → existing GPT parse flow unchanged. New `transcribing` layer added to VoiceLogSheet between recording and transcript.

**Tech Stack:** Next.js App Router, OpenAI SDK (`openai.audio.transcriptions.create`), MediaRecorder API, FormData, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-05-29-whisper-voice-transcription-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/api/client/nutrition/voice-transcribe/route.ts` | Create | Whisper transcription — auth, rate limit, FormData parse, Whisper call |
| `app/api/client/nutrition/voice-parse/route.ts` | Modify | Remove `lang` from Zod schema and destructuring |
| `components/client/smart/VoiceLogSheet.tsx` | Modify | Replace SpeechRecognition with MediaRecorder, add `transcribing` layer |

`lib/nutrition/voice.ts` — untouched. `cleanTranscript` still called in `parseTranscript`.

---

## Task 1: Create `/api/client/nutrition/voice-transcribe/route.ts`

**Files:**
- Create: `app/api/client/nutrition/voice-transcribe/route.ts`

- [ ] **Step 1.1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import OpenAI from "openai"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service()
    .from("coach_clients")
    .select("id")
    .eq("user_id", userId)
    .single()
  return data?.id ?? null
}

// ── In-memory rate limit (10 req/min per clientId) ───────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(clientId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(clientId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

const WHISPER_PROMPT =
  "nutrition sportive, whey protéine, Nutri Muscle, créatine, BCAA, caséine, isolat, grammes, millilitres, kcal, lipides, glucides"

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // 25MB Whisper limit

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  if (!checkRateLimit(clientId)) {
    return NextResponse.json({ error: "rate_limit", retry_after: 60 }, { status: 429 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 })
  }

  const audio = formData.get("audio") as File | null
  if (!audio) return NextResponse.json({ error: "no_audio" }, { status: 400 })
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      // no language → auto-detect (handles FR/EN/ES mixed speech)
      prompt: WHISPER_PROMPT,
    })
    return NextResponse.json({ transcript: transcription.text })
  } catch {
    return NextResponse.json({ error: "transcription_failed" }, { status: 422 })
  }
}
```

- [ ] **Step 1.2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 1.3: Commit**

```bash
git add app/api/client/nutrition/voice-transcribe/route.ts
git commit -m "feat(voice): add /voice-transcribe route with Whisper API"
```

---

## Task 2: Update `/api/client/nutrition/voice-parse/route.ts`

**Files:**
- Modify: `app/api/client/nutrition/voice-parse/route.ts`

- [ ] **Step 2.1: Remove `lang` from Zod schema**

Find this block (lines ~38–42):

```typescript
const bodySchema = z.object({
  transcript: z.string().min(3).max(1000),
  physiological_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lang: z.enum(["fr", "en", "es"]).default("fr"),
})
```

Replace with:

```typescript
const bodySchema = z.object({
  transcript: z.string().min(3).max(1000),
  physiological_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
```

- [ ] **Step 2.2: Remove `lang` from destructuring**

Find (line ~59):

```typescript
const { transcript, lang } = body.data
```

Replace with:

```typescript
const { transcript } = body.data
```

- [ ] **Step 2.3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If `lang` is used elsewhere in the file (e.g. in the GPT system prompt string), it is already hardcoded FR — confirm there are no remaining references to the `lang` variable.

- [ ] **Step 2.4: Commit**

```bash
git add app/api/client/nutrition/voice-parse/route.ts
git commit -m "refactor(voice): remove lang param from voice-parse route"
```

---

## Task 3: Replace SpeechRecognition with MediaRecorder in VoiceLogSheet

**Files:**
- Modify: `components/client/smart/VoiceLogSheet.tsx`

This is the largest change. Work through it in sub-steps.

### Step 3.1 — Update Layer type

- [ ] Find line:

```typescript
type Layer = "recording" | "transcript" | "processing" | "review"
```

Replace with:

```typescript
type Layer = "recording" | "transcribing" | "transcript" | "processing" | "review"
```

### Step 3.2 — Remove SpeechRecognition refs, add MediaRecorder refs

- [ ] Find the ref declarations block (lines ~73–84):

```typescript
const recognitionRef  = useRef<any>(null)
const analyserRef     = useRef<AnalyserNode | null>(null)
const audioCtxRef     = useRef<AudioContext | null>(null)
const streamRef       = useRef<MediaStream | null>(null)
const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
const maxTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
const waveFrameRef    = useRef<number | null>(null)
const modeRef         = useRef<RecordMode>("idle")
const accRef          = useRef("")
const openRef         = useRef(open)
const startingRef     = useRef(false)
const lastStopTimeRef = useRef<number>(0) // tracks when recognition last stopped — mic cooldown
```

Replace with:

```typescript
const recorderRef     = useRef<MediaRecorder | null>(null)
const chunksRef       = useRef<Blob[]>([])
const mimeTypeRef     = useRef<string>("audio/webm;codecs=opus")
const analyserRef     = useRef<AnalyserNode | null>(null)
const audioCtxRef     = useRef<AudioContext | null>(null)
const streamRef       = useRef<MediaStream | null>(null)
const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
const maxTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
const waveFrameRef    = useRef<number | null>(null)
const modeRef         = useRef<RecordMode>("idle")
const openRef         = useRef(open)
```

### Step 3.3 — Remove state variables no longer needed

- [ ] Find and remove these state lines (they are individual `useState` calls in the block around lines ~63–71):

```typescript
const [rawTranscript, setRawTranscript]         = useState("")
const [interimTranscript, setInterimTranscript] = useState("")
```

Keep all other state variables intact.

### Step 3.4 — Remove `isSpeechSupported` and `MIC_COOLDOWN_MS`

- [ ] Remove the constant:

```typescript
const MIC_COOLDOWN_MS = 600
```

- [ ] Remove the derived value:

```typescript
const isSpeechSupported = typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
```

### Step 3.5 — Update `stopAll`

- [ ] Find `stopAll` function. Replace with:

```typescript
function stopAll() {
  if (timerRef.current)    { clearInterval(timerRef.current);  timerRef.current = null }
  if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }
  if (waveFrameRef.current){ cancelAnimationFrame(waveFrameRef.current); waveFrameRef.current = null }
  if (recorderRef.current) { try { recorderRef.current.stop() } catch {} recorderRef.current = null }
  if (streamRef.current)   { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null }
  analyserRef.current = null
  chunksRef.current = []
}
```

### Step 3.6 — Update reset on open

- [ ] Find the `useEffect` that resets state when `open` changes. Remove refs to `accRef`, `startingRef`. Replace the `if (open)` branch reset with:

```typescript
if (open) {
  setLayer("recording")
  setModeSync("idle")
  setInputMode("voice")
  setTextInput("")
  setEditableTranscript("")
  setError(null)
  setItems([])
  setElapsedSec(0)
  setWaveBars([6, 6, 6, 6, 6, 6, 6])
  chunksRef.current = []
} else {
  stopAll()
  setModeSync("idle")
}
```

### Step 3.7 — Add `transcribeBlob` function

- [ ] Add this function after the `startWave` function:

```typescript
const transcribeBlob = useCallback(async (blob: Blob) => {
  if (!openRef.current) return
  const ext = mimeTypeRef.current.includes("mp4") ? "mp4" : "webm"
  const file = new File([blob], `audio.${ext}`, { type: blob.type })
  const form = new FormData()
  form.append("audio", file)
  try {
    const res = await fetch("/api/client/nutrition/voice-transcribe", {
      method: "POST",
      body: form,
    })
    if (!res.ok) {
      setError(t("voice.error_parse"))
      setLayer("recording")
      setModeSync("idle")
      return
    }
    const { transcript } = await res.json()
    if (!openRef.current) return
    setEditableTranscript(transcript)
    setLayer("transcript")
  } catch {
    setError(t("voice.error_parse"))
    setLayer("recording")
    setModeSync("idle")
  }
}, [t])
```

### Step 3.8 — Replace `stopRecording`

- [ ] Replace the entire `stopRecording` function with:

```typescript
const stopRecording = useCallback(() => {
  if (timerRef.current)     { clearInterval(timerRef.current);  timerRef.current = null }
  if (maxTimerRef.current)  { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }
  if (waveFrameRef.current) { cancelAnimationFrame(waveFrameRef.current); waveFrameRef.current = null }
  if (streamRef.current)    { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  if (audioCtxRef.current)  { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null }
  // recorder.stop() triggers onstop → transcribeBlob
  if (recorderRef.current) {
    try { recorderRef.current.stop() } catch {}
    recorderRef.current = null
  }
  setWaveBars([6, 6, 6, 6, 6, 6, 6])
  setModeSync("idle")
  setLayer("transcribing")
}, [])
```

### Step 3.9 — Replace `startRecording`

- [ ] Replace the entire `startRecording` function with:

```typescript
const startRecording = useCallback(async () => {
  if (modeRef.current === "recording") return
  setModeSync("recording")
  setError(null)
  setElapsedSec(0)
  chunksRef.current = []

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    setModeSync("idle")
    setError("Microphone inaccessible")
    return
  }

  if (!openRef.current) {
    stream.getTracks().forEach(t => t.stop())
    setModeSync("idle")
    return
  }

  streamRef.current = stream

  try {
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyserRef.current = analyser
    startWave()
  } catch {}

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/mp4"
  mimeTypeRef.current = mimeType

  const recorder = new MediaRecorder(stream, { mimeType })
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunksRef.current.push(e.data)
  }
  recorder.onstop = () => {
    const blob = new Blob(chunksRef.current, { type: mimeType })
    transcribeBlob(blob)
  }
  recorderRef.current = recorder
  recorder.start(250)

  timerRef.current = setInterval(() => {
    setElapsedSec(p => {
      if (p + 1 >= MAX_RECORD_SEC) {
        stopRecording()
        return MAX_RECORD_SEC
      }
      return p + 1
    })
  }, 1000)

  maxTimerRef.current = setTimeout(() => {
    if (modeRef.current === "recording") stopRecording()
  }, (MAX_RECORD_SEC + 2) * 1000)
}, [transcribeBlob, stopRecording])
```

### Step 3.10 — Update `handleReRecord`

- [ ] Find `handleReRecord`. Replace with:

```typescript
function handleReRecord() {
  setEditableTranscript("")
  setError(null)
  setLayer("recording")
  setElapsedSec(0)
  chunksRef.current = []
}
```

### Step 3.11 — Update the recording layer JSX

- [ ] In the `{layer === "recording"}` block, find the voice sub-panel (`{inputMode === "voice" && ...}`).

Remove the entire `{!isSpeechSupported ? ... : ...}` conditional. Replace with the inner content only (always render the recorder UI — MediaRecorder is universally supported):

```tsx
{inputMode === "voice" && (
  <div className="flex flex-col items-center" style={{ gap: 0 }}>
    {/* Waveform */}
    <div className="flex items-center justify-center gap-[4px]" style={{ height: 44, marginBottom: 10 }}>
      {waveBars.map((h, i) => (
        <motion.div key={i}
          style={{ width: 4, borderRadius: 99, backgroundColor: isActive ? "#f2f2f2" : "#2e2e2e" }}
          animate={{ height: isActive ? h : 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
        />
      ))}
    </div>

    {/* Timer */}
    <span
      className="tabular-nums font-barlow-condensed font-bold tracking-[0.16em]"
      style={{ fontSize: 12, color: timeWarning ? '#b0b0b0' : isActive ? '#f2f2f2' : '#5a5a5a', marginBottom: 14 }}
    >
      {formatTime(elapsedSec)}
      {timeWarning && ` / ${formatTime(MAX_RECORD_SEC)}`}
    </span>

    {/* Spacer where live transcript was */}
    <div style={{ height: 52, marginBottom: 24 }} />

    {error && (
      <p className="text-[12px] text-red-400 text-center" style={{ marginBottom: 16 }}>{error}</p>
    )}

    {/* Mic button */}
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={handleToggle}
        className="flex flex-col items-center justify-center select-none"
        style={{
          width: 88, height: 88, borderRadius: 22, gap: 5,
          background: isActive ? '#222222' : '#f2f2f2',
          border: 'none',
        }}
      >
        <Mic size={28} strokeWidth={2}
          style={{ color: isActive ? '#f2f2f2' : '#080808' }}
        />
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-barlow-condensed)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.14em', lineHeight: 1,
          color: isActive ? '#f2f2f2' : '#080808',
        }}>
          {isActive ? "ARRÊTER" : "ENREGISTRER"}
        </span>
      </button>
    </div>

    <p className="font-barlow-condensed font-bold uppercase text-center"
      style={{ fontSize: 9, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.18)', lineHeight: 1.4 }}>
      {isActive ? "Appuyer pour arrêter" : "Appuyer pour enregistrer"}
    </p>
  </div>
)}
```

### Step 3.12 — Add `transcribing` layer JSX

- [ ] After the `{layer === "recording" && (...)}` block, add the new layer before `{layer === "transcript" && (...)}`:

```tsx
{/* ── LAYER: transcribing ── */}
{layer === "transcribing" && (
  <div className="flex flex-col items-center justify-center h-48 gap-5">
    <div className="h-10 w-10 border-2 border-[#2e2e2e] border-t-[#f2f2f2] rounded-full animate-spin" />
    <p className="text-[13px] text-white/50 font-barlow-condensed uppercase tracking-[0.14em]">
      Transcription…
    </p>
  </div>
)}
```

### Step 3.13 — Remove unused imports

- [ ] Remove `RotateCcw` from lucide imports if it's no longer used (it's still used in the transcript layer — keep it).

- [ ] Verify no remaining references to `rawTranscript`, `interimTranscript`, `accRef`, `startingRef`, `lastStopTimeRef`, `isSpeechSupported`, `MIC_COOLDOWN_MS` exist in the file.

```bash
grep -n "rawTranscript\|interimTranscript\|accRef\|startingRef\|lastStopTimeRef\|isSpeechSupported\|MIC_COOLDOWN_MS" components/client/smart/VoiceLogSheet.tsx
```

Expected: no output.

### Step 3.14 — TypeScript check

- [ ] Run:

```bash
npx tsc --noEmit
```

Expected: 0 errors.

### Step 3.15 — Commit

```bash
git add components/client/smart/VoiceLogSheet.tsx
git commit -m "feat(voice): replace SpeechRecognition with MediaRecorder + Whisper transcription"
```

---

## Task 4: Update CHANGELOG and project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 4.1: Update CHANGELOG.md**

Add at the top under today's date `## 2026-05-29`:

```
FEATURE: Replace SpeechRecognition with Whisper API for voice nutrition logger — fixes "whey"/"Nutri Muscle" homophone errors
FEATURE: Add /api/client/nutrition/voice-transcribe route with sports nutrition vocabulary prompt
REFACTOR: Remove lang param from /api/client/nutrition/voice-parse route
```

- [ ] **Step 4.2: Update project-state.md**

In the "Dernières Avancées" section, add a new entry dated `2026-05-29`:

```markdown
### 2026-05-29 — Whisper Voice Transcription — Fix Homophone Errors

- `app/api/client/nutrition/voice-transcribe/route.ts` — new route: auth + rate limit + FormData parse + `openai.audio.transcriptions.create` (whisper-1, no language → auto-detect, sports nutrition prompt)
- `app/api/client/nutrition/voice-parse/route.ts` — removed `lang` from Zod schema (Whisper handles language; GPT response stays FR)
- `components/client/smart/VoiceLogSheet.tsx` — SpeechRecognition replaced by MediaRecorder (webm/opus on Chrome, mp4 on Safari); new `transcribing` layer (spinner) between recording stop and editable transcript; live transcript preview removed
- Points de vigilance: `recorder.start(250)` chunks every 250ms — required so `ondataavailable` fires; `recorder.onstop` triggers only after `stop()` resolves all pending chunks; MediaRecorder requires iOS 14.5+
```

- [ ] **Step 4.3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "chore: update CHANGELOG and project-state for Whisper voice transcription"
```
