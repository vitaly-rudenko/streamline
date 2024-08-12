const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const TWO_MINUTE_MS = 2 * MINUTE_MS
const TWO_HOUR_MS = 2 * HOUR_MS
const TWO_DAY_MS = 2 * DAY_MS

export function fastFormatRelativeDate(from: number, to: number) {
  const ms = to - from
  if (ms < MINUTE_MS) return 'just now'
  if (ms < TWO_MINUTE_MS) return 'a minute ago'
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)} minutes ago`
  if (ms < TWO_HOUR_MS) return 'an hour ago'
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)} hours ago`
  if (ms < TWO_DAY_MS) return 'a day ago'
  return `${Math.floor(ms / TWO_DAY_MS)} days ago`
}
