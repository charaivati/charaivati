export type HealthFlag =
  | 'headache' | 'fatigue' | 'poor_sleep'
  | 'digestive' | 'back_pain' | 'stress'

export type DriveSignal = 'Seeker' | 'Guardian' | 'Builder' | 'Keeper'

export type PeakWindow = 'morning' | 'afternoon' | 'evening' | 'night'

export type WorkPattern = 'shift' | 'freelance' | 'fixed' | 'student' | 'irregular'

export interface ParsedSignals {
  healthFlags: HealthFlag[]
  driveSignals: DriveSignal[]
  peakWindow: PeakWindow | null
  workPattern: WorkPattern | null
  estimatedHours: number | null
  sentiment: 'positive' | 'neutral' | 'negative'
}

const HEALTH_KEYWORDS: Record<HealthFlag, string[]> = {
  headache:   ['headache', 'head hurts', 'head is killing', 'migraine'],
  fatigue:    ['tired', 'exhausted', 'drained', 'no energy', 'worn out'],
  poor_sleep: ["can't sleep", "couldn't sleep", 'bad sleep', "didn't sleep", 'insomnia', 'up all night'],
  digestive:  ['stomach', 'nausea', 'nauseous', 'threw up', 'upset stomach'],
  back_pain:  ['back pain', 'back hurts', 'back is killing'],
  stress:     ['stressed', 'anxious', 'overwhelmed', 'anxiety', "can't cope"],
}

const DRIVE_KEYWORDS: Record<DriveSignal, string[]> = {
  Seeker:   ['want to understand', 'need to know why', 'makes me curious', 'always wondering',
             'reading about', 'studying', 'learning about', 'what does it mean'],
  Guardian: ['take care of', 'worried about them', 'my family', 'looking after',
             "can't let them down", 'responsible for', 'protect'],
  Builder:  ['i built', 'i made', 'i launched', 'i want to build', 'i want to create',
             'working on', 'shipping', 'side project', 'startup', 'want to start'],
  Keeper:   ['i manage', 'i save', 'i organise', 'i track', 'systems', 'routine',
             'budget', 'planning', 'keeping things running'],
}

const PEAK_KEYWORDS: Record<PeakWindow, string[]> = {
  morning:   ['morning person', 'early riser', 'up early', 'best in the morning', 'morning hours'],
  evening:   ['evening', 'after work', 'evenings are mine', '9pm', '8pm'],
  night:     ['night owl', 'late night', 'work at night', 'after midnight', 'up late'],
  afternoon: ['afternoon', 'lunch break', 'midday', 'post lunch'],
}

const WORK_KEYWORDS: Record<WorkPattern, string[]> = {
  shift:     ['shift', 'night shift', 'day shift', 'after my shift', 'before my shift'],
  freelance: ['freelance', 'gig', 'contracts', 'clients', 'self-employed'],
  fixed:     ['office hours', 'work from home', 'wfh', '9 to 5', 'desk job'],
  student:   ['student', 'college', 'university', 'classes', 'semester'],
  irregular: [],
}

const POSITIVE_WORDS = ['good', 'great', 'amazing', 'happy', 'excited', 'love', 'fantastic', 'well']
const NEGATIVE_WORDS = ['bad', 'terrible', 'awful', 'sad', 'struggling', 'hard', 'difficult', 'worst']

function matchKeywords<T extends string>(text: string, map: Record<T, string[]>): T[] {
  const lower = text.toLowerCase()
  return (Object.keys(map) as T[]).filter(key =>
    map[key].some(phrase => lower.includes(phrase))
  )
}

export function parseMessage(text: string): ParsedSignals {
  const lower = text.toLowerCase()

  const healthFlags = matchKeywords<HealthFlag>(text, HEALTH_KEYWORDS)
  const driveSignals = matchKeywords<DriveSignal>(text, DRIVE_KEYWORDS)

  const peakMatches = matchKeywords<PeakWindow>(text, PEAK_KEYWORDS)
  const peakWindow: PeakWindow | null = peakMatches[0] ?? null

  const workMatches = matchKeywords<WorkPattern>(text, WORK_KEYWORDS)
  const workPattern: WorkPattern | null = workMatches[0] ?? null

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*hours?/i)
  const estimatedHours = hoursMatch ? parseFloat(hoursMatch[1]) : null

  const words = lower.split(/\s+/)
  let pos = 0
  let neg = 0
  for (const w of words) {
    if (POSITIVE_WORDS.includes(w)) pos++
    if (NEGATIVE_WORDS.includes(w)) neg++
  }
  const sentiment = pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral'

  return { healthFlags, driveSignals, peakWindow, workPattern, estimatedHours, sentiment }
}

export default parseMessage
