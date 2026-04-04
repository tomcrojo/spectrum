const LEADING_PROMPT_PHRASES = [
  /^(?:please\s+)?(?:help me(?:\s+to)?|can you|could you|would you|will you)\s+/i,
  /^(?:please\s+)?(?:i need(?: you)? to|need to|we need to|we should)\s+/i,
  /^(?:please\s+)?(?:let's|lets)\s+/i
]

function normalizePrompt(prompt: string): string {
  return prompt
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')
    .replace(/^[@/]\S+\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function suggestT3CodeTitleFromPrompt(prompt: string): string | null {
  const normalized = normalizePrompt(prompt)
  if (!normalized) {
    return null
  }

  const firstSentence = normalized.split(/[.!?](?:\s|$)/, 1)[0]?.trim() ?? normalized
  let candidate = firstSentence

  for (const phrase of LEADING_PROMPT_PHRASES) {
    candidate = candidate.replace(phrase, '')
  }

  candidate = candidate
    .replace(/\bplease\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[`"'([{]+/, '')
    .replace(/[`"')\]}:;,.!?-]+$/, '')
    .trim()

  if (candidate.length < 3) {
    return null
  }

  const words = candidate.split(' ').filter(Boolean)
  const compact = words.slice(0, 7).join(' ').trim()
  if (!compact) {
    return null
  }

  return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`
}
