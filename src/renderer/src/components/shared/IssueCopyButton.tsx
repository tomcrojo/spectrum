import { useEffect, useRef, useState } from 'react'
import { Button } from './Button'

async function fallbackCopyText(text: string): Promise<void> {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export async function copyIssueText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  await fallbackCopyText(text)
}

export function formatIssuePayload(title: string, summary: string, debug?: string | null): string {
  const parts = [title, '', summary.trim()]

  if (debug?.trim()) {
    parts.push('', 'Debug details:', debug.trim())
  }

  return parts.join('\n')
}

export function IssueCopyButton({
  payload,
  className
}: {
  payload: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  return (
    <Button
      size="sm"
      variant="ghost"
      className={className}
      onClick={() => {
        void copyIssueText(payload)
          .then(() => {
            setCopied(true)
            if (resetTimerRef.current !== null) {
              window.clearTimeout(resetTimerRef.current)
            }
            resetTimerRef.current = window.setTimeout(() => {
              setCopied(false)
              resetTimerRef.current = null
            }, 1600)
          })
          .catch((error) => {
            console.error('[IssueCopyButton] failed to copy issue payload', error)
          })
      }}
    >
      {copied ? 'Copied' : 'Copy issue'}
    </Button>
  )
}
