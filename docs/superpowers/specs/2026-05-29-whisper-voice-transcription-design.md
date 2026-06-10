# Whisper Voice Transcription — Design Spec

**Date:** 2026-05-29  
**Status:** Approved  
**Scope:** Replace browser SpeechRecognition with OpenAI Whisper in the voice nutrition logger

---

## Problem

Browser `SpeechRecognition` (Web Speech API) lacks sports/nutrition vocabulary context. Terms like "whey protéine" are transcribed as "oui" or "ou". Brand names like "Nutri Muscle" become "Prouti Muscle". The GPT parsing layer receives corrupted text and cannot recover.

---

## Solution

Replace `SpeechRecognition` with `MediaRecorder` (audio blob capture) → Whisper API transcription server-side. Whisper accepts a `prompt` hint that biases recognition toward sports/nutrition vocabulary, fixing the homophone problem at the source.

---

## Architecture

### Flow

```
BEFORE: SpeechRecognition → live transcript → /voice-parse → GPT → review

AFTER:
MediaRecorder (blob)
  → stop
  → layer "transcribing" (Whisper in progress)
  → POST /voice-transcribe → Whisper API
  → transcript text
  → layer "transcript" (editable — unchanged)
  → user confirms
  → POST /voice-parse → GPT (unchanged)
  → layer "review" (unchanged)
```

### Layer sequence in VoiceLogSheet

`recording` → `transcribing` *(new)* → `transcript` → `processing` → `review`

---

## Components

### 1. New route — `/api/client/nutrition/voice-transcribe`

```typescript
export async function POST(req: NextRequest) {
  // auth + clientId (same pattern as voice-parse)
  // rate limit: 10 req/min

  const formData = await req.formData()
  const audio = formData.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'no_audio' }, { status: 400 })
  if (audio.size > 25 * 1024 * 1024)
    return NextResponse.json({ error: 'file_too_large' }, { status: 413 })

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const transcription = await openai.audio.transcriptions.create({
    file: audio,
    model: 'whisper-1',
    // no language param → auto-detect (handles FR/EN/ES mixed)
    prompt: 'nutrition sportive, whey protéine, Nutri Muscle, créatine, BCAA, caséine, isolat, grammes, millilitres, kcal, lipides, glucides',
  })

  return NextResponse.json({ transcript: transcription.text })
}
```

**Key:** The `prompt` field biases Whisper toward sports nutrition vocabulary without needing a custom dictionary.

### 2. Modified — `/api/client/nutrition/voice-parse`

Remove `lang` from Zod schema (Whisper handles language detection; GPT response stays FR):

```typescript
// Remove:
lang: z.enum(["fr", "en", "es"]).default("fr"),
```

GPT system prompt language stays hardcoded FR — LLM response must always be in French.

### 3. Modified — `VoiceLogSheet.tsx`

**Remove:**
- `SpeechRecognition` / `webkitSpeechRecognition` + all recognition logic
- `recognitionRef`, `accRef`, `interimTranscript`, `rawTranscript`
- `startingRef`, `lastStopTimeRef`, `MIC_COOLDOWN_MS`
- `isSpeechSupported` check
- Live transcript preview in recording layer

**Add:**
```typescript
const recorderRef  = useRef<MediaRecorder | null>(null)
const chunksRef    = useRef<Blob[]>([])
const mimeTypeRef  = useRef<string>('audio/webm;codecs=opus')
```

**`startRecording`:**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
streamRef.current = stream
// waveform analyser — unchanged

const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus' : 'audio/mp4'
mimeTypeRef.current = mimeType
chunksRef.current = []
const recorder = new MediaRecorder(stream, { mimeType })
recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
recorder.onstop = () => transcribeBlob(new Blob(chunksRef.current, { type: mimeType }))
recorderRef.current = recorder
recorder.start(250) // chunk every 250ms
```

**`stopRecording`:**
```typescript
recorderRef.current?.stop()  // triggers onstop → transcribeBlob
recorderRef.current = null
// stop stream, stop timer, reset waveform — unchanged
setLayer('transcribing')     // new layer
```

**`transcribeBlob`:**
```typescript
async function transcribeBlob(blob: Blob) {
  if (!openRef.current) return
  const ext = mimeTypeRef.current.includes('mp4') ? 'mp4' : 'webm'
  const file = new File([blob], `audio.${ext}`, { type: blob.type })
  const form = new FormData()
  form.append('audio', file)
  try {
    const res = await fetch('/api/client/nutrition/voice-transcribe', { method: 'POST', body: form })
    if (!res.ok) { setError(t('voice.error_parse')); setLayer('recording'); return }
    const { transcript } = await res.json()
    setEditableTranscript(transcript)
    setLayer('transcript')
  } catch {
    setError(t('voice.error_parse'))
    setLayer('recording')
  }
}
```

**New `transcribing` layer UI:**
```tsx
{layer === 'transcribing' && (
  <div className="flex flex-col items-center justify-center h-48 gap-5">
    <div className="h-10 w-10 border-2 border-[#2e2e2e] border-t-[#f2f2f2] rounded-full animate-spin" />
    <p className="text-[13px] text-white/50 font-barlow-condensed uppercase tracking-[0.14em]">
      Transcription…
    </p>
  </div>
)}
```

---

## Audio Format

| Browser | Format | Size (90s) |
|---------|--------|-----------|
| Chrome/Android | `audio/webm;codecs=opus` | ~0.5–1 MB |
| Safari/iOS | `audio/mp4` | ~1–1.5 MB |

Whisper limit: 25MB. Both formats well within limit at max 90s recording.

iOS compatibility: MediaRecorder supported iOS 14.5+. Better than SpeechRecognition (broken < iOS 16.4).

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/client/nutrition/voice-transcribe/route.ts` | New — Whisper call |
| `app/api/client/nutrition/voice-parse/route.ts` | Remove `lang` from Zod schema |
| `components/client/smart/VoiceLogSheet.tsx` | SpeechRecognition → MediaRecorder, add `transcribing` layer |
| `lib/nutrition/voice.ts` | `cleanTranscript` preserved, applied post-Whisper |

---

## What Stays Unchanged

- `cleanTranscript()` — still applied to Whisper output before sending to GPT (removes fillers)
- `/voice-parse` route logic — GPT parsing, food item matching, rate limit
- Review layer — item editing, quantity adjustment, logMeal
- Text input mode (Keyboard tab) — completely unaffected
- Waveform animation — AnalyserNode still used during recording

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Mic permission denied | Error message, stay on `recording` layer |
| Whisper call fails | Error message, back to `recording` layer (re-record) |
| File too large (>25MB) | 413 response, error message |
| Rate limit | 429 → `voice.error_rate_limit` message |
| Empty transcript | Back to `recording` layer |

---

## Cost

Whisper pricing: ~$0.006/min. At 90s max = $0.009/session. Negligible.
