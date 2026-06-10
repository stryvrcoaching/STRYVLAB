'use client'

const SLIDER_STYLES = `
  .stryvr-phase-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ffffff;
    cursor: pointer;
    border: none;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.4);
    transition: transform 0.1s ease;
  }
  .stryvr-phase-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ffffff;
    cursor: pointer;
    border: none;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.4);
  }
  .stryvr-phase-slider:active::-webkit-slider-thumb {
    transform: scale(1.12);
  }
`

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  accentColor?: string
}

export default function StryvrRangeSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  accentColor = '#1f8a65',
}: Props) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100
  const trackBg = `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${pct}%, rgba(255,255,255,0.06) ${pct}%, rgba(255,255,255,0.06) 100%)`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold text-white/45">{label}</span>
        <span className="text-[15px] font-bold text-white tabular-nums shrink-0">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="relative">
        <style>{SLIDER_STYLES}</style>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="stryvr-phase-slider w-full h-1.5 rounded-full outline-none appearance-none cursor-pointer"
          style={{ background: trackBg }}
        />
      </div>
    </div>
  )
}
