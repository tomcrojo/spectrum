import type {
  PanelRuntimeState,
  ThreadNotificationKind
} from '@renderer/stores/panel-runtime.store'

function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NaN
  }

  return Date.parse(value)
}

export function hasUnreadThreadNotification(
  runtime: PanelRuntimeState | null | undefined
): runtime is PanelRuntimeState & {
  t3NotificationKind: ThreadNotificationKind
  t3NotificationUpdatedAt: string
} {
  if (!runtime?.t3NotificationKind || !runtime.t3NotificationUpdatedAt) {
    return false
  }

  const updatedAt = parseTimestamp(runtime.t3NotificationUpdatedAt)
  if (Number.isNaN(updatedAt)) {
    return false
  }

  const acknowledgedAt = parseTimestamp(runtime.t3NotificationAcknowledgedAt)
  return Number.isNaN(acknowledgedAt) || updatedAt > acknowledgedAt
}

export function getUnreadThreadNotificationKind(
  runtime: PanelRuntimeState | null | undefined
): ThreadNotificationKind | null {
  return hasUnreadThreadNotification(runtime) ? runtime.t3NotificationKind : null
}

export function getNotificationPriority(
  kind: ThreadNotificationKind | null | undefined
): number {
  if (kind === 'requires-input') {
    return 2
  }

  if (kind === 'completed') {
    return 1
  }

  return 0
}

export function getDominantNotificationKind(
  kinds: Array<ThreadNotificationKind | null | undefined>
): ThreadNotificationKind | null {
  let dominant: ThreadNotificationKind | null = null

  for (const kind of kinds) {
    if (getNotificationPriority(kind) > getNotificationPriority(dominant)) {
      dominant = kind ?? null
    }
  }

  return dominant
}

export function getThreadNotificationClasses(kind: ThreadNotificationKind | null | undefined): {
  dot: string
  badge: string
} {
  if (kind === 'requires-input') {
    return {
      dot: 'bg-amber-400 ring-amber-500/20',
      badge: 'bg-amber-500/14 text-amber-300 border-amber-500/20'
    }
  }

  return {
    dot: 'bg-sky-400 ring-sky-500/20',
    badge: 'bg-sky-500/14 text-sky-300 border-sky-500/20'
  }
}
