export const NUTRITION_UI_COLORS = {
  protein: '#5dba87',
  carbs: '#ffd15e',
  fat: '#ff8660',
  water: '#2373c8',
  calories: '#689ffa',
  trainingDay: '#5dba87',
  trainingDayBg: 'rgba(93,186,135,0.10)',
  trainingDayBorder: 'rgba(93,186,135,0.28)',
  restDay: '#808080',
  restDayBg: 'rgba(255,255,255,0.05)',
  restDayBorder: 'rgba(255,255,255,0.10)',
} as const

// Training accent — same as protein color, shared across workout UI
export const TRAINING_ACCENT = '#5dba87'
// rgba components for inline alpha variants
export const TRAINING_ACCENT_RGB = '93,186,135'
// Volume overflow color (actual > MAV) — amber
export const VOLUME_OVERFLOW_COLOR = '#c47c2b'

