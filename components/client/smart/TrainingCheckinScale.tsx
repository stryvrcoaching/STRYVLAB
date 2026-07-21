'use client'

type Phase = 'pre' | 'post'

interface TrainingCheckinScaleProps {
  phase: Phase
  value: number | null
  onValueChange: (value: number) => void
}

const READINESS_OPTIONS = [
  { value: 1, label: 'Très basse' },
  { value: 3, label: 'Basse' },
  { value: 5, label: 'Moyenne' },
  { value: 7, label: 'Bonne' },
  { value: 9, label: 'Très bonne' },
]

export default function TrainingCheckinScale({ phase, value, onValueChange }: TrainingCheckinScaleProps) {
  const isPre = phase === 'pre'

  if (isPre) {
    return (
      <section aria-label="Énergie avant la séance">
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/35">Énergie</p>

        <div className="mt-3 overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#0d0d0d] p-1.5" role="radiogroup" aria-label="Énergie avant la séance">
          <div className="grid grid-cols-5 gap-1.5">
          {READINESS_OPTIONS.map((option) => {
            const selected = value === option.value
            const charged = value !== null && option.value <= value

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onValueChange(option.value)}
                className={`relative flex min-h-[72px] flex-col items-center justify-center rounded-[16px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                  charged ? 'bg-[#1f8a65]' : 'bg-white/[0.045] active:bg-white/[0.10]'
                }`}
              >
                <span className={`font-barlow-condensed text-[18px] font-bold tabular-nums ${charged ? 'text-white' : 'text-white/30'}`}>
                  {String(option.value).padStart(2, '0')}
                </span>
                {selected ? <span className="absolute bottom-2 h-1 w-4 rounded-full bg-white" /> : null}
                <span className="sr-only">{option.label}</span>
              </button>
            )
          })}
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1.5 text-center">
            {READINESS_OPTIONS.map((option) => (
              <span key={option.value} className={`text-[9px] font-semibold leading-[1.15] ${value === option.value ? 'text-white' : 'text-white/35'}`}>
                {option.label}
              </span>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="training-exertion-question" className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/35">Effort global</p>
      <p id="training-exertion-question" className="mt-2 text-[12px] text-white/45">1 = très facile · 10 = maximal</p>

      <div className="mt-4 grid grid-cols-5 gap-2" role="radiogroup" aria-labelledby="training-exertion-question">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => {
          const selected = value === level

          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onValueChange(level)}
              className={`flex min-h-[58px] items-center justify-center rounded-2xl border font-barlow-condensed text-[22px] font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                selected
                  ? 'border-[#1f8a65] bg-[#1f8a65] text-white'
                  : 'border-white/[0.07] bg-[#0d0d0d] text-white/55 active:bg-white/[0.07]'
              }`}
            >
              {String(level).padStart(2, '0')}
            </button>
          )
        })}
      </div>
    </section>
  )
}
