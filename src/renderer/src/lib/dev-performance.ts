const isDev = import.meta.env.DEV

interface DevPerformanceSnapshot {
  counters: Record<string, number>
  timings: Record<string, number[]>
}

declare global {
  interface Window {
    __spectrumPerf__?: DevPerformanceSnapshot
  }
}

function getSnapshot(): DevPerformanceSnapshot | null {
  if (!isDev || typeof window === 'undefined') {
    return null
  }

  if (!window.__spectrumPerf__) {
    window.__spectrumPerf__ = {
      counters: {},
      timings: {}
    }
  }

  return window.__spectrumPerf__
}

export function setDevPerformanceCounter(name: string, value: number): void {
  const snapshot = getSnapshot()
  if (!snapshot) {
    return
  }

  snapshot.counters[name] = value
  console.debug(`[perf] ${name}:`, value)
}

export function recordDevPerformanceTiming(name: string, durationMs: number): void {
  const snapshot = getSnapshot()
  if (!snapshot) {
    return
  }

  const timings = snapshot.timings[name] ?? []
  timings.push(durationMs)
  snapshot.timings[name] = timings.slice(-20)
  console.debug(`[perf] ${name}: ${durationMs.toFixed(1)}ms`)
}

export function incrementDevMountCount(name: string): void {
  const snapshot = getSnapshot()
  if (!snapshot) {
    return
  }

  snapshot.counters[`mount:${name}`] = (snapshot.counters[`mount:${name}`] ?? 0) + 1
}
