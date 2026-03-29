import type { ArchivedTimestampFormat } from '@renderer/stores/ui.store'

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto'
})

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
})

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1]
]

export function formatWorkspaceLastEditedAt(
  value: string | null,
  format: ArchivedTimestampFormat,
  now = Date.now()
): string {
  if (!value) {
    return 'Never edited'
  }

  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) {
    return 'Unknown'
  }

  if (format === 'full') {
    return fullDateFormatter.format(timestamp)
  }

  const diffInSeconds = Math.round((timestamp.getTime() - now) / 1000)
  const absoluteDiffInSeconds = Math.abs(diffInSeconds)

  if (absoluteDiffInSeconds < 30) {
    return 'just now'
  }

  for (const [unit, secondsPerUnit] of RELATIVE_UNITS) {
    if (absoluteDiffInSeconds >= secondsPerUnit || unit === 'second') {
      return relativeFormatter.format(
        Math.round(diffInSeconds / secondsPerUnit),
        unit
      )
    }
  }

  return 'just now'
}
