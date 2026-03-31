import agentDoneUrl from '@renderer/assets/sounds/agent_done.wav'

let audioContext: AudioContext | null = null
let audioBuffer: AudioBuffer | null = null
let loadPromise: Promise<void> | null = null

async function loadSound(): Promise<void> {
  if (audioBuffer) return

  audioContext = new AudioContext()

  const response = await fetch(agentDoneUrl)
  const arrayBuffer = await response.arrayBuffer()
  audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
}

export function preloadNotificationSound(): void {
  if (loadPromise) return
  loadPromise = loadSound().catch(() => {
    // Silently fail — audio is non-critical
  })
}

export function playNotificationSound(): void {
  if (!audioContext || !audioBuffer) {
    // Try to load if not loaded yet
    preloadNotificationSound()
    return
  }

  try {
    // Resume context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }

    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContext.destination)
    source.start(0)
  } catch {
    // Silently fail — audio is non-critical
  }
}
