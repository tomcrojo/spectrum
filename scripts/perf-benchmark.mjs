#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import http from 'node:http'

const require = createRequire(import.meta.url)
const { chromium, _electron: electron } = require('playwright-core')

const repoRoot = process.cwd()
const outputDir = path.join(repoRoot, 'artifacts', 'performance')
const defaultChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const defaultScenario = {
  fillerProjectCount: 6,
  mediumWorkspaceCount: 4,
  largeWorkspaceCount: 8,
  panelsPerWorkspace: 3,
  mediumTaskCount: 24,
  largeTaskCount: 72
}

function parseArgs(argv) {
  const options = {
    mode: 'both',
    output: '',
    headless: true,
    runtimePowerMode: 'high',
    skipBuild: false,
    scenario: { ...defaultScenario }
  }

  for (const arg of argv) {
    if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length)
      continue
    }
    if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length)
      continue
    }
    if (arg === '--headed') {
      options.headless = false
      continue
    }
    if (arg.startsWith('--runtime-power=')) {
      options.runtimePowerMode = arg.slice('--runtime-power='.length)
      continue
    }
    if (arg === '--skip-build') {
      options.skipBuild = true
      continue
    }
    if (arg.startsWith('--large-workspaces=')) {
      options.scenario.largeWorkspaceCount = Number(arg.slice('--large-workspaces='.length))
      continue
    }
    if (arg.startsWith('--medium-workspaces=')) {
      options.scenario.mediumWorkspaceCount = Number(arg.slice('--medium-workspaces='.length))
      continue
    }
    if (arg.startsWith('--panels-per-workspace=')) {
      options.scenario.panelsPerWorkspace = Number(arg.slice('--panels-per-workspace='.length))
      continue
    }
    if (arg.startsWith('--large-tasks=')) {
      options.scenario.largeTaskCount = Number(arg.slice('--large-tasks='.length))
      continue
    }
    if (arg.startsWith('--medium-tasks=')) {
      options.scenario.mediumTaskCount = Number(arg.slice('--medium-tasks='.length))
      continue
    }
    if (arg.startsWith('--filler-projects=')) {
      options.scenario.fillerProjectCount = Number(arg.slice('--filler-projects='.length))
      continue
    }
  }

  if (!['browser', 'electron', 'both'].includes(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`)
  }

  if (!['low', 'mid', 'high'].includes(options.runtimePowerMode)) {
    throw new Error(`Unsupported runtime power mode: ${options.runtimePowerMode}`)
  }

  for (const [key, value] of Object.entries(options.scenario)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid scenario value for ${key}: ${value}`)
    }
  }

  return options
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatMs(value) {
  return `${value.toFixed(1)} ms`
}

function average(values) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function percentile(values, ratio) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * ratio))
  const lower = Math.floor(index)
  const upper = Math.ceil(index)

  if (lower === upper) {
    return sorted[lower]
  }

  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

function bytesToMiB(bytes) {
  return bytes / (1024 * 1024)
}

function kilobytesToMiB(kilobytes) {
  return kilobytes / 1024
}

function normalizeRate(value, { min = 0, max = 10000, digits = 2 } = {}) {
  if (value == null || !Number.isFinite(value) || value < min || value > max) {
    return null
  }

  return Number(value.toFixed(digits))
}

function getChromePath() {
  if (process.env.SPECTRUM_BENCHMARK_CHROME_PATH) {
    return process.env.SPECTRUM_BENCHMARK_CHROME_PATH
  }
  if (fs.existsSync(defaultChromePath)) {
    return defaultChromePath
  }
  throw new Error(
    `Google Chrome was not found. Set SPECTRUM_BENCHMARK_CHROME_PATH to a Chromium-based browser binary.`
  )
}

function getElectronBinaryPath() {
  return require('electron')
}

function systemInfo() {
  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    node: process.version,
    totalMemoryGb: Number((os.totalmem() / (1024 ** 3)).toFixed(1)),
    cpuModel: os.cpus()[0]?.model ?? 'unknown',
    cpuCount: os.cpus().length
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(
        new Error(
          `Command failed (${command} ${args.join(' ')}):\n${stderr || stdout || `exit ${code}`}`
        )
      )
    })
  })
}

function sampleTopRowsByPid(pids) {
  if (pids.length === 0) {
    return []
  }

  const args = ['-l', '2', '-s', '1']
  for (const pid of pids) {
    args.push('-pid', String(pid))
  }
  args.push('-stats', 'pid,power,cpu,mem,command')

  const result = spawnSync('top', args, {
    cwd: repoRoot,
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to sample top output')
  }

  const sections = result.stdout.split(/\nPID\s+POWER\s+%CPU\s+MEM\s+COMMAND\n/g)
  const table = sections.at(-1) ?? result.stdout

  return table
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => /^\s*\d+\s+/.test(line))
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.+?)\s*$/)
      if (!match) {
        return null
      }

      return {
        pid: Number(match[1]),
        power: Number(match[2]),
        cpu: Number(match[3]),
        memory: match[4],
        command: match[5]
      }
    })
    .filter(Boolean)
}

async function waitForPort(port, { timeoutMs = 15_000 } = {}) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const isOpen = await new Promise((resolve) => {
      const socket = net.createConnection({ port, host: '127.0.0.1' })
      socket.once('connect', () => {
        socket.end()
        resolve(true)
      })
      socket.once('error', () => {
        resolve(false)
      })
    })

    if (isOpen) {
      return
    }

    await sleep(150)
  }

  throw new Error(`Timed out waiting for port ${port}`)
}

async function waitForHttp(url, { timeoutMs = 20_000 } = {}) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume()
        resolve((response.statusCode ?? 500) < 500)
      })
      request.on('error', () => resolve(false))
    })

    if (ok) {
      return
    }

    await sleep(200)
  }

  throw new Error(`Timed out waiting for ${url}`)
}

function spawnManaged(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  })
  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  return {
    child,
    readLogs: () => ({ stdout, stderr })
  }
}

async function terminateManaged(processHandle) {
  const { child } = processHandle
  if (child.exitCode !== null || child.killed) {
    return
  }

  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(4_000)
  ])

  if (child.exitCode === null && !child.killed) {
    child.kill('SIGKILL')
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      sleep(2_000)
    ])
  }
}

function sqlQuote(value) {
  if (value == null) {
    return 'NULL'
  }
  return `'${String(value).replaceAll("'", "''")}'`
}

function createPanel(panelId, panelType, title, extra = {}) {
  return {
    id: panelId,
    type: panelType,
    title,
    ...extra
  }
}

function filePathForWorkspace(index) {
  if (index % 2 === 0) {
    return path.join(repoRoot, 'README.md')
  }
  return path.join(repoRoot, 'package.json')
}

function browserUrlForWorkspace(workspaceIndex) {
  const title = encodeURIComponent(`Benchmark Browser ${workspaceIndex + 1}`)
  const body = encodeURIComponent(
    `<html><head><title>${title}</title></head><body style="font-family:monospace;padding:24px;background:#101010;color:#f5f5f5"><h1>${title}</h1><p>Spectrum benchmark browser payload.</p></body></html>`
  )
  return `data:text/html;charset=utf-8,${body}`
}

function projectInsertSql({
  id,
  name,
  description,
  progress,
  color,
  taskCount,
  workspaceCount,
  panelsPerWorkspace
}) {
  const now = new Date().toISOString()
  const statements = []

  statements.push(
    `INSERT INTO projects (
      id,
      name,
      repo_path,
      description,
      progress,
      color,
      git_workspaces_enabled,
      default_browser_cookie_policy,
      default_terminal_mode,
      archived,
      created_at,
      updated_at
    ) VALUES (
      ${sqlQuote(id)},
      ${sqlQuote(name)},
      ${sqlQuote(repoRoot)},
      ${sqlQuote(description)},
      ${progress},
      ${sqlQuote(color)},
      0,
      'isolated',
      'project-root',
      0,
      ${sqlQuote(now)},
      ${sqlQuote(now)}
    );`
  )

  for (let index = 0; index < taskCount; index += 1) {
    statements.push(
      `INSERT INTO tasks (
      id,
      project_id,
      title,
      completed,
      created_at,
      updated_at
      ) VALUES (
        ${sqlQuote(`${id}-task-${index + 1}`)},
        ${sqlQuote(id)},
        ${sqlQuote(`Benchmark task ${index + 1}`)},
        ${index % 4 === 0 ? 1 : 0},
        ${sqlQuote(now)},
        ${sqlQuote(now)}
      );`
    )
  }

  for (let workspaceIndex = 0; workspaceIndex < workspaceCount; workspaceIndex += 1) {
    const workspaceId = `${id}-workspace-${workspaceIndex + 1}`
    const panels = []

    if (panelsPerWorkspace >= 1) {
      panels.push(
        createPanel(
          `${workspaceId}-terminal`,
          'terminal',
          `Terminal ${workspaceIndex + 1}`
        )
      )
    }

    if (panelsPerWorkspace >= 2) {
      const filePath = filePathForWorkspace(workspaceIndex)
      panels.push(
        createPanel(
          `${workspaceId}-file`,
          'file',
          path.basename(filePath),
          { filePath }
        )
      )
    }

    if (panelsPerWorkspace >= 3) {
      panels.push(
        createPanel(
          `${workspaceId}-browser`,
          'browser',
          `Browser ${workspaceIndex + 1}`,
          { url: browserUrlForWorkspace(workspaceIndex), width: 640, height: 420 }
        )
      )
    }

    for (let extraIndex = 3; extraIndex < panelsPerWorkspace; extraIndex += 1) {
      panels.push(
        createPanel(
          `${workspaceId}-terminal-${extraIndex + 1}`,
          'terminal',
          `Terminal ${workspaceIndex + 1}.${extraIndex + 1}`
        )
      )
    }

    statements.push(
      `INSERT INTO workspaces (
        id,
        project_id,
        name,
        layout_state,
        archived,
        created_at,
        updated_at,
        last_panel_edited_at
      ) VALUES (
        ${sqlQuote(workspaceId)},
        ${sqlQuote(id)},
        ${sqlQuote(`Workspace ${workspaceIndex + 1}`)},
        ${sqlQuote(JSON.stringify({
        panels,
        sizes: panels.map(() => 1)
      }))},
        0,
        ${sqlQuote(now)},
        ${sqlQuote(now)},
        ${sqlQuote(now)}
      );`
    )
  }

  return statements
}

function seedBenchmarkDatabase(dbPath, scenario) {
  ensureDirectory(path.dirname(dbPath))
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath, { force: true })
  }

  const migrationsDir = path.join(repoRoot, 'src', 'main', 'db', 'migrations')
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  const statements = [
    'PRAGMA journal_mode = WAL;',
    'PRAGMA foreign_keys = ON;',
    'BEGIN;',
    `CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`
  ]

  for (const file of migrationFiles) {
    statements.push(fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
    statements.push(
      `INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (${sqlQuote(file)}, datetime('now'));`
    )
  }

  statements.push(
    ...projectInsertSql({
      id: 'benchmark-project-large',
      name: 'Spectrum Benchmark Large',
      description: 'Large seeded project for benchmark runs',
    progress: 2,
    color: 'cobalt-glow',
    taskCount: scenario.largeTaskCount,
    workspaceCount: scenario.largeWorkspaceCount,
    panelsPerWorkspace: scenario.panelsPerWorkspace
    }),
    ...projectInsertSql({
      id: 'benchmark-project-medium',
      name: 'Spectrum Benchmark Medium',
      description: 'Medium seeded project for switch timing',
    progress: 1,
    color: 'verdigris',
    taskCount: scenario.mediumTaskCount,
    workspaceCount: scenario.mediumWorkspaceCount,
    panelsPerWorkspace: Math.max(2, Math.min(scenario.panelsPerWorkspace, 3))
    })
  )

  for (let index = 0; index < scenario.fillerProjectCount; index += 1) {
    statements.push(
      ...projectInsertSql({
        id: `benchmark-project-filler-${index + 1}`,
        name: `Spectrum Filler ${index + 1}`,
        description: 'Sidebar filler',
        progress: index % 4,
        color: 'graphite',
        taskCount: 0,
        workspaceCount: 1,
        panelsPerWorkspace: 1
      })
    )
  }

  statements.push('COMMIT;')

  const result = spawnSync('sqlite3', [dbPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    input: statements.join('\n')
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to seed SQLite database')
  }
}

function capturePageIssues(page) {
  const issues = {
    pageErrors: [],
    consoleErrors: [],
    consoleWarnings: []
  }

  page.on('pageerror', (error) => {
    issues.pageErrors.push(error.message)
  })
  page.on('console', (message) => {
    const location = message.location()
    const isMissingFavicon =
      message.type() === 'error' &&
      message.text() === 'Failed to load resource: the server responded with a status of 404 (Not Found)' &&
      typeof location.url === 'string' &&
      location.url.endsWith('/favicon.ico')
    const isElectronAbortNoise =
      message.type() === 'error' &&
      message.text().includes("ERR_ABORTED (-3) loading")
    const isElectronDevSecurityWarning =
      message.type() === 'warning' &&
      message.text().includes('Electron Security Warning (Insecure Content-Security-Policy)')

    if (isMissingFavicon || isElectronAbortNoise || isElectronDevSecurityWarning) {
      return
    }

    if (message.type() === 'error') {
      issues.consoleErrors.push(message.text())
      return
    }
    if (message.type() === 'warning') {
      issues.consoleWarnings.push(message.text())
    }
  })

  return issues
}

async function installBenchmarkProbe(page) {
  await page.addInitScript(() => {
    const maxFrameSamples = 60_000
    const maxEventSamples = 12_000
    const maxLongTaskSamples = 2_000

    const trim = (list, max) => {
      if (list.length >= max) {
        list.splice(0, list.length - max + 1)
      }
    }

    if (!window.__spectrumBenchmarkProbe__) {
      window.__spectrumBenchmarkProbe__ = {
        frameDeltas: [],
        events: [],
        inputToNextPaint: [],
        longTasks: [],
        observerStatus: {
          eventTiming: 'uninitialized',
          longTask: 'uninitialized'
        }
      }
    }

    const probe = window.__spectrumBenchmarkProbe__
    let lastFrameAt = 0

    const tick = (timestamp) => {
      if (lastFrameAt > 0) {
        trim(probe.frameDeltas, maxFrameSamples)
        probe.frameDeltas.push(timestamp - lastFrameAt)
      }
      lastFrameAt = timestamp
      window.requestAnimationFrame(tick)
    }

    window.requestAnimationFrame(tick)

    for (const eventType of ['keydown', 'click', 'pointerdown', 'wheel']) {
      window.addEventListener(
        eventType,
        (event) => {
          const startedAt = performance.now()
          const key = 'key' in event && typeof event.key === 'string' ? event.key : ''
          window.requestAnimationFrame((paintAt) => {
            trim(probe.inputToNextPaint, maxEventSamples)
            probe.inputToNextPaint.push({
              type: eventType,
              key,
              durationMs: paintAt - startedAt
            })
          })
        },
        { capture: true, passive: true }
      )
    }

    if ('PerformanceObserver' in window) {
      try {
        const eventObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            trim(probe.events, maxEventSamples)
            probe.events.push({
              name: entry.name,
              startTime: entry.startTime,
              processingStart:
                typeof entry.processingStart === 'number' ? entry.processingStart : null,
              duration: entry.duration,
              interactionId:
                typeof entry.interactionId === 'number' ? entry.interactionId : null
            })
          }
        })
        eventObserver.observe({ type: 'event', buffered: true, durationThreshold: 0 })
        probe.observerStatus.eventTiming = 'active'
      } catch (error) {
        probe.observerStatus.eventTiming = `error:${String(error)}`
      }

      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            trim(probe.longTasks, maxLongTaskSamples)
            probe.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration
            })
          }
        })
        longTaskObserver.observe({ type: 'longtask', buffered: true })
        probe.observerStatus.longTask = 'active'
      } catch (error) {
        probe.observerStatus.longTask = `error:${String(error)}`
      }
    } else {
      probe.observerStatus.eventTiming = 'unsupported'
      probe.observerStatus.longTask = 'unsupported'
    }
  })
}

async function resetBenchmarkProbe(page) {
  await page.evaluate(() => {
    if (!window.__spectrumBenchmarkProbe__) {
      return
    }

    window.__spectrumBenchmarkProbe__.frameDeltas = []
    window.__spectrumBenchmarkProbe__.events = []
    window.__spectrumBenchmarkProbe__.inputToNextPaint = []
    window.__spectrumBenchmarkProbe__.longTasks = []
  })
}

async function readBenchmarkProbe(page) {
  return page.evaluate(() => window.__spectrumBenchmarkProbe__ ?? null)
}

async function waitForProjectList(page) {
  await page.locator('text=Spectrum Benchmark Large').waitFor({ timeout: 20_000 })
}

async function getProjectOpenSampleCount(page) {
  return page.evaluate(() => window.__spectrumPerf__?.timings?.['project-open']?.length ?? 0)
}

async function openProjectAndCapture(page, projectName, previousCount, expectedPanelCount) {
  const startedAt = Date.now()
  await page.getByRole('button', { name: projectName, exact: true }).first().click()

  while (Date.now() - startedAt < 20_000) {
    const snapshot = await page.evaluate(() => {
      const timings = window.__spectrumPerf__?.timings?.['project-open'] ?? []
      return {
        hasPerfSnapshot: Boolean(window.__spectrumPerf__),
        count: timings.length,
        latestTimingMs: timings.at(-1) ?? null,
        panelCount: document.querySelectorAll('[data-panel-root="true"]').length,
        xtermCount: document.querySelectorAll('.xterm').length,
        iframeCount: document.querySelectorAll('iframe').length,
        webviewCount: document.querySelectorAll('webview').length,
        counters: window.__spectrumPerf__?.counters ?? {}
      }
    })

    if (snapshot.hasPerfSnapshot && snapshot.count > previousCount && snapshot.panelCount > 0) {
      return snapshot
    }

    if (!snapshot.hasPerfSnapshot && snapshot.panelCount === expectedPanelCount) {
      return {
        ...snapshot,
        latestTimingMs: Date.now() - startedAt
      }
    }

    await sleep(150)
  }

  throw new Error(`Timed out opening ${projectName}`)
}

async function getRendererMemory(page) {
  return page.evaluate(() => {
    const memory = performance.memory
    if (!memory) {
      return null
    }

    return {
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize
    }
  })
}

async function setRuntimePowerMode(page, runtimePowerMode) {
  await page.evaluate((mode) => {
    window.localStorage.setItem('spectrum:runtime-power-mode', mode)
  }, runtimePowerMode)
}

function summarizeFrameMetrics(frameDeltas) {
  const deltas = frameDeltas.filter((value) => Number.isFinite(value) && value > 0 && value < 250)
  const baselineCandidates = deltas.filter((value) => value >= 4 && value <= 40)
  const estimatedRefreshPeriodMs =
    baselineCandidates.length > 0 ? median(baselineCandidates) : 16.7
  const p95FrameTimeMs = percentile(deltas, 0.95)
  const p99FrameTimeMs = percentile(deltas, 0.99)

  return {
    frameCount: deltas.length,
    estimatedRefreshHz: Number((1000 / estimatedRefreshPeriodMs).toFixed(1)),
    averageFps: deltas.length > 0 ? Number((1000 / average(deltas)).toFixed(1)) : 0,
    p95FrameTimeMs: Number(p95FrameTimeMs.toFixed(2)),
    p99FrameTimeMs: Number(p99FrameTimeMs.toFixed(2)),
    p99Fps: p99FrameTimeMs > 0 ? Number((1000 / p99FrameTimeMs).toFixed(1)) : 0,
    longFramesOver50Ms: deltas.filter((value) => value > 50).length,
    droppedFramesOver2xRefresh: deltas.filter((value) => value > estimatedRefreshPeriodMs * 2).length
  }
}

function summarizeInputMetrics(entries, inputToNextPaint) {
  const relevantEvents = entries.filter((entry) =>
    ['keydown', 'click', 'pointerdown', 'wheel'].includes(entry.name)
  )
  const inputDelayValues = relevantEvents
    .map((entry) =>
      entry.processingStart == null ? null : entry.processingStart - entry.startTime
    )
    .filter((value) => value != null && Number.isFinite(value) && value >= 0)
  const keydownDelayValues = relevantEvents
    .filter((entry) => entry.name === 'keydown')
    .map((entry) =>
      entry.processingStart == null ? null : entry.processingStart - entry.startTime
    )
    .filter((value) => value != null && Number.isFinite(value) && value >= 0)
  const paintValues = inputToNextPaint
    .map((entry) => entry.durationMs)
    .filter((value) => Number.isFinite(value) && value >= 0)
  const keyPaintValues = inputToNextPaint
    .filter((entry) => entry.type === 'keydown')
    .map((entry) => entry.durationMs)
    .filter((value) => Number.isFinite(value) && value >= 0)

  return {
    observedEventCount: relevantEvents.length,
    inputDelayP95Ms: Number(percentile(inputDelayValues, 0.95).toFixed(2)),
    inputDelayP99Ms: Number(percentile(inputDelayValues, 0.99).toFixed(2)),
    keydownInputDelayP95Ms: Number(percentile(keydownDelayValues, 0.95).toFixed(2)),
    keydownInputDelayP99Ms: Number(percentile(keydownDelayValues, 0.99).toFixed(2)),
    inputToNextPaintP95Ms: Number(percentile(paintValues, 0.95).toFixed(2)),
    inputToNextPaintP99Ms: Number(percentile(paintValues, 0.99).toFixed(2)),
    keydownToNextPaintP95Ms: Number(percentile(keyPaintValues, 0.95).toFixed(2)),
    keydownToNextPaintP99Ms: Number(percentile(keyPaintValues, 0.99).toFixed(2))
  }
}

function summarizeLongTaskMetrics(entries) {
  const durations = entries
    .map((entry) => entry.duration)
    .filter((value) => Number.isFinite(value) && value >= 0)

  return {
    count: durations.length,
    totalDurationMs: Number(durations.reduce((sum, value) => sum + value, 0).toFixed(2)),
    p95DurationMs: Number(percentile(durations, 0.95).toFixed(2)),
    p99DurationMs: Number(percentile(durations, 0.99).toFixed(2)),
    maxDurationMs: Number((durations.length > 0 ? Math.max(...durations) : 0).toFixed(2))
  }
}

function summarizeProbeMetrics(probe) {
  if (!probe) {
    return null
  }

  return {
    observerStatus: probe.observerStatus ?? {},
    frames: summarizeFrameMetrics(probe.frameDeltas ?? []),
    input: summarizeInputMetrics(probe.events ?? [], probe.inputToNextPaint ?? []),
    longTasks: summarizeLongTaskMetrics(probe.longTasks ?? [])
  }
}

async function clickProjectDashboardToggle(page, projectName) {
  const card = page.getByRole('button', { name: projectName, exact: true }).first()
  await card.waitFor({ state: 'visible', timeout: 20_000 })
  const box = await card.boundingBox()

  if (!box) {
    throw new Error(`Could not resolve bounding box for project card ${projectName}`)
  }

  await page.mouse.click(box.x + box.width - 18, box.y + box.height / 2)
}

async function createPerfProject(page) {
  await page.getByRole('button', { name: 'New Project' }).click()
  const nameInput = page.locator('input[placeholder="my-awesome-project"]')
  await nameInput.click()
  await page.keyboard.type('Spectrum Perf Created', { delay: 18 })
  const repoInput = page.locator('input[placeholder="/Users/you/projects/my-project"]')
  await repoInput.click()
  await page.keyboard.type(repoRoot, { delay: 10 })
  const descriptionInput = page.locator(
    'textarea[placeholder="A brief description of the project"]'
  )
  await descriptionInput.click()
  await page.keyboard.type('Benchmark-created project for high power UI scenario.', {
    delay: 14
  })
  await page.getByRole('button', { name: 'Create Project' }).click()
  await page
    .getByRole('button', { name: 'Spectrum Perf Created', exact: true })
    .first()
    .waitFor({ timeout: 20_000 })
}

async function changeProjectIconToEmoji(page) {
  await page.locator('button').filter({ hasText: 'Change icon' }).first().click()
  await page.locator('button').filter({ hasText: 'Emoji' }).first().click()
  await page.locator('button').filter({ hasText: '✨' }).first().click()
  await page.getByRole('button', { name: 'Save Icon' }).click()
}

async function addPanelsFromWorkspaceList(page, count = 4) {
  for (let index = 0; index < count; index += 1) {
    const card = page.locator('.project-workspace-card').first()
    await card.hover()
    await page.getByLabel('Add Panel').first().click()

    const label =
      index % 4 === 0
        ? 'Terminal'
        : index % 4 === 1
          ? 'Browser'
          : index % 4 === 2
            ? 'File Editor'
            : 'T3Code'
    await page.getByRole('button', { name: label, exact: true }).first().click()
    await sleep(180)
  }
}

async function createAdditionalWorkspaces(page, count = 2) {
  for (let index = 0; index < count; index += 1) {
    await page.locator('button').filter({ hasText: '+ Add' }).first().click()
    await sleep(220)
  }
}

async function scrollStructuredCanvas(page, loops = 6) {
  const canvas = page.locator('[data-canvas-scroll-root="true"]')
  await canvas.waitFor({ state: 'visible', timeout: 20_000 })
  const box = await canvas.boundingBox()

  if (!box) {
    throw new Error('Could not resolve canvas bounding box')
  }

  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45)

  for (let index = 0; index < loops; index += 1) {
    await page.mouse.wheel(0, 720)
    await sleep(100)
    await page.mouse.wheel(840, 0)
    await sleep(100)
    await page.mouse.wheel(-360, -420)
    await sleep(100)
  }

  return canvas.evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
    maxLeft: element.scrollWidth - element.clientWidth,
    maxTop: element.scrollHeight - element.clientHeight
  }))
}

async function runHighPowerInteractionScenario(page, expectedPanelCountsByProjectName) {
  const timeline = []
  const currentProjectOpenCount = () => getProjectOpenSampleCount(page)

  let sampleCount = await currentProjectOpenCount()
  timeline.push({ step: 'open-large-start', at: Date.now() })
  await openProjectAndCapture(
    page,
    'Spectrum Benchmark Large',
    sampleCount,
    expectedPanelCountsByProjectName['Spectrum Benchmark Large']
  )

  timeline.push({ step: 'open-dashboard', at: Date.now() })
  await clickProjectDashboardToggle(page, 'Spectrum Benchmark Large')
  await page
    .getByRole('heading', { name: 'Project Dashboard' })
    .first()
    .waitFor({ timeout: 10_000 })

  timeline.push({ step: 'create-workspaces', at: Date.now() })
  await createAdditionalWorkspaces(page, 2)

  timeline.push({ step: 'add-panels', at: Date.now() })
  await addPanelsFromWorkspaceList(page, 4)

  timeline.push({ step: 'change-icon', at: Date.now() })
  await changeProjectIconToEmoji(page)

  timeline.push({ step: 'scroll-large', at: Date.now() })
  const largeScroll = await scrollStructuredCanvas(page, 7)

  timeline.push({ step: 'create-project', at: Date.now() })
  await createPerfProject(page)

  return {
    timeline,
    scrollSnapshots: {
      large: largeScroll
    }
  }
}

function summarizeElectronAppMetrics(appMetrics) {
  const summarized = appMetrics.map((metric) => ({
    type: metric.type,
    serviceName: metric.serviceName ?? null,
    pid: metric.pid ?? null,
    cpuPercent: normalizeRate(metric.cpu?.percentCPUUsage, { max: 400 }),
    idleWakeupsPerSecond: normalizeRate(metric.cpu?.idleWakeupsPerSecond, { max: 10000 }),
    workingSetMiB:
      metric.memory?.workingSetSize != null
        ? Number(kilobytesToMiB(metric.memory.workingSetSize).toFixed(1))
        : null,
    privateMiB:
      metric.memory?.privateBytes != null
        ? Number(kilobytesToMiB(metric.memory.privateBytes).toFixed(1))
        : null
  }))

  const totalWorkingSetMiB = summarized.reduce(
    (sum, metric) => sum + (metric.workingSetMiB ?? 0),
    0
  )
  const totalCpuPercent = summarized.reduce((sum, metric) => sum + (metric.cpuPercent ?? 0), 0)
  const totalIdleWakeupsPerSecond = summarized.reduce(
    (sum, metric) => sum + (metric.idleWakeupsPerSecond ?? 0),
    0
  )

  return {
    totalWorkingSetMiB: Number(totalWorkingSetMiB.toFixed(1)),
    totalCpuPercent: Number(totalCpuPercent.toFixed(2)),
    totalIdleWakeupsPerSecond: Number(totalIdleWakeupsPerSecond.toFixed(2)),
    processes: summarized
  }
}

function summarizeElectronPowerSamples(samples) {
  if (samples.length === 0) {
    return {
      sampleCount: 0,
      totalPower: null,
      totalCpu: null,
      totalIdleWakeupsPerSecond: null,
      gpuProcess: null
    }
  }

  const totalPowerValues = samples
    .map((sample) => sample.totalPower)
    .filter((value) => Number.isFinite(value))
  const totalCpuValues = samples
    .map((sample) => sample.totalCpu)
    .filter((value) => Number.isFinite(value))
  const totalIdleWakeupValues = samples
    .map((sample) => sample.totalIdleWakeupsPerSecond)
    .filter((value) => Number.isFinite(value))
  const gpuSamples = samples
    .map((sample) => sample.processes.find((processMetric) => processMetric.type === 'GPU') ?? null)
    .filter(Boolean)

  return {
    sampleCount: samples.length,
    totalPower: {
      average: Number(average(totalPowerValues).toFixed(2)),
      p95: Number(percentile(totalPowerValues, 0.95).toFixed(2)),
      max: Number(Math.max(...totalPowerValues).toFixed(2))
    },
    totalCpu: {
      average: Number(average(totalCpuValues).toFixed(2)),
      p95: Number(percentile(totalCpuValues, 0.95).toFixed(2)),
      max: Number(Math.max(...totalCpuValues).toFixed(2))
    },
    totalIdleWakeupsPerSecond: {
      average: Number(average(totalIdleWakeupValues).toFixed(2)),
      p95: Number(percentile(totalIdleWakeupValues, 0.95).toFixed(2)),
      max: Number(Math.max(...totalIdleWakeupValues).toFixed(2))
    },
    gpuProcess:
      gpuSamples.length > 0
        ? {
            cpuAverage: Number(
              average(gpuSamples.map((sample) => sample.cpu ?? 0)).toFixed(2)
            ),
            cpuMax: Number(
              Math.max(...gpuSamples.map((sample) => sample.cpu ?? 0)).toFixed(2)
            ),
            powerAverage: Number(
              average(gpuSamples.map((sample) => sample.power ?? 0)).toFixed(2)
            ),
            powerMax: Number(
              Math.max(...gpuSamples.map((sample) => sample.power ?? 0)).toFixed(2)
            )
          }
        : null,
    samples
  }
}

function createElectronProcessSampler(electronApp) {
  const samples = []
  let running = false
  let loopPromise = null

  const sampleOnce = async () => {
    const appMetrics = await electronApp.evaluate(async ({ app }) => app.getAppMetrics())
    const appSummary = summarizeElectronAppMetrics(appMetrics)
    const pids = appSummary.processes
      .map((metric) => metric.pid)
      .filter((pid) => Number.isFinite(pid))
    const topRows = sampleTopRowsByPid(pids)
    const topRowByPid = new Map(topRows.map((row) => [row.pid, row]))

    const processes = appSummary.processes.map((metric) => {
      const topRow = metric.pid == null ? null : topRowByPid.get(metric.pid) ?? null
      return {
        pid: metric.pid,
        type: metric.type,
        serviceName: metric.serviceName,
        cpu:
          topRow?.cpu != null && topRow.cpu > 0
            ? topRow.cpu
            : metric.cpuPercent ?? 0,
        power: topRow?.power ?? 0,
        memory: topRow?.memory ?? null,
        command: topRow?.command ?? null,
        cpuPercent: metric.cpuPercent,
        idleWakeupsPerSecond: metric.idleWakeupsPerSecond,
        workingSetMiB: metric.workingSetMiB
      }
    })

    samples.push({
      capturedAt: new Date().toISOString(),
      totalPower: Number(
        processes.reduce((sum, metric) => sum + (metric.power ?? 0), 0).toFixed(2)
      ),
      totalCpu: Number(
        processes.reduce((sum, metric) => sum + (metric.cpu ?? 0), 0).toFixed(2)
      ),
      totalIdleWakeupsPerSecond: appSummary.totalIdleWakeupsPerSecond,
      processes
    })
  }

  return {
    async start() {
      if (running) {
        return
      }

      running = true
      loopPromise = (async () => {
        while (running) {
          const startedAt = Date.now()
          await sampleOnce()
          const elapsed = Date.now() - startedAt
          await sleep(Math.max(250, 1500 - elapsed))
        }
      })()
    },
    async stop() {
      running = false
      if (loopPromise) {
        await loopPromise
      }
      return summarizeElectronPowerSamples(samples)
    }
  }
}

async function collectModeMetrics({
  mode,
  page,
  issues,
  getExtraMetrics,
  expectedPanelCountsByProjectName,
  runScenario
}) {
  await waitForProjectList(page)

  let projectOpenCount = await getProjectOpenSampleCount(page)
  const openRuns = []

  for (const projectName of [
    'Spectrum Benchmark Medium',
    'Spectrum Benchmark Large',
    'Spectrum Benchmark Medium',
    'Spectrum Benchmark Large'
  ]) {
    const snapshot = await openProjectAndCapture(
      page,
      projectName,
      projectOpenCount,
      expectedPanelCountsByProjectName[projectName]
    )
    projectOpenCount = snapshot.count
    openRuns.push({
      projectName,
      projectOpenMs: snapshot.latestTimingMs ?? 0,
      panelCount: snapshot.panelCount,
      xtermCount: snapshot.xtermCount,
      iframeCount: snapshot.iframeCount,
      webviewCount: snapshot.webviewCount,
      counters: snapshot.counters
    })
    await sleep(500)
  }

  const largeProjectRun = openRuns.filter((run) => run.projectName === 'Spectrum Benchmark Large').at(-1)
  const rendererMemory = await getRendererMemory(page)
  await resetBenchmarkProbe(page)
  const scenarioDetails = runScenario
    ? await runScenario()
    : { probeSummary: null, interactionSummary: null }
  const extraMetrics = await getExtraMetrics()

  return {
    mode,
    projectOpenRuns: openRuns,
    averageProjectOpenMs: average(openRuns.map((run) => run.projectOpenMs)),
    medianProjectOpenMs: median(openRuns.map((run) => run.projectOpenMs)),
    largeProjectSnapshot: largeProjectRun ?? null,
    rendererMemory,
    issues,
    scenario: scenarioDetails,
    extraMetrics
  }
}

function makeTempHome(mode) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `spectrum-benchmark-${mode}-`))
}

function browserModeDbPath(tempHome) {
  return path.join(tempHome, '.spectrum-dev', 'spectrum-dev.db')
}

function electronModeDbPath(tempHome) {
  return path.join(tempHome, 'Library', 'Application Support', 'spectrum', 'spectrum.db')
}

async function runBrowserMode(options) {
  const tempHome = makeTempHome('browser')
  const dbPath = browserModeDbPath(tempHome)
  seedBenchmarkDatabase(dbPath, options.scenario)

  const env = {
    ...process.env,
    HOME: tempHome,
    SPECTRUM_DB_PATH: dbPath
  }
  delete env.ELECTRON_RUN_AS_NODE

  const devServer = spawnManaged('node', ['scripts/dev-server.cjs'], { env })
  const vite = spawnManaged('npx', ['vite', '--config', 'vite.browser.config.ts'], {
    env: {
      ...env,
      VITE_DEV_SERVER_WS_URL: 'ws://localhost:3001'
    }
  })

  let browser = null
  try {
    await waitForPort(3001)
    await waitForHttp('http://localhost:5173')

    const coldStartStartedAt = Date.now()
    browser = await chromium.launch({
      executablePath: getChromePath(),
      headless: options.headless
    })
    const page = await browser.newPage()
    await installBenchmarkProbe(page)
    const issues = capturePageIssues(page)

    await page.goto('http://localhost:5173', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    })
    await waitForProjectList(page)
    const coldStartMs = Date.now() - coldStartStartedAt
    await setRuntimePowerMode(page, options.runtimePowerMode)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
    await waitForProjectList(page)

    const metrics = await collectModeMetrics({
      mode: 'browser',
      page,
      issues,
      expectedPanelCountsByProjectName: {
        'Spectrum Benchmark Medium':
          options.scenario.mediumWorkspaceCount *
          Math.max(2, Math.min(options.scenario.panelsPerWorkspace, 3)),
        'Spectrum Benchmark Large':
          options.scenario.largeWorkspaceCount * options.scenario.panelsPerWorkspace
      },
      runScenario: async () => {
        const interactionSummary = await runHighPowerInteractionScenario(page, {
          'Spectrum Benchmark Medium':
            options.scenario.mediumWorkspaceCount *
            Math.max(2, Math.min(options.scenario.panelsPerWorkspace, 3)),
          'Spectrum Benchmark Large':
            options.scenario.largeWorkspaceCount * options.scenario.panelsPerWorkspace
        })
        return {
          interactionSummary,
          probeSummary: summarizeProbeMetrics(await readBenchmarkProbe(page))
        }
      },
      getExtraMetrics: async () => ({
        devServerLogs: devServer.readLogs(),
        viteLogs: vite.readLogs()
      })
    })

    return {
      ...metrics,
      coldStartMs,
      tempHome,
      dbPath
    }
  } finally {
    if (browser) {
      await browser.close()
    }
    await terminateManaged(vite)
    await terminateManaged(devServer)
  }
}

async function runElectronMode(options) {
  const tempHome = makeTempHome('electron')
  const dbPath = electronModeDbPath(tempHome)
  seedBenchmarkDatabase(dbPath, options.scenario)

  if (!options.skipBuild) {
    await runCommand('npm', ['run', 'build'])
  }

  const env = {
    ...process.env,
    HOME: tempHome,
    SPECTRUM_DB_PATH: dbPath
  }
  delete env.ELECTRON_RUN_AS_NODE

  const launchStartedAt = Date.now()
  const electronApp = await electron.launch({
    executablePath: getElectronBinaryPath(),
    args: ['.'],
    cwd: repoRoot,
    env
  })

  try {
    const page = await electronApp.firstWindow()
    await installBenchmarkProbe(page)
    const issues = capturePageIssues(page)

    await page.waitForLoadState('domcontentloaded')
    await waitForProjectList(page)
    const coldStartMs = Date.now() - launchStartedAt
    await setRuntimePowerMode(page, options.runtimePowerMode)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 })
    await waitForProjectList(page)
    const processSampler = createElectronProcessSampler(electronApp)

    const metrics = await collectModeMetrics({
      mode: 'electron',
      page,
      issues,
      expectedPanelCountsByProjectName: {
        'Spectrum Benchmark Medium':
          options.scenario.mediumWorkspaceCount *
          Math.max(2, Math.min(options.scenario.panelsPerWorkspace, 3)),
        'Spectrum Benchmark Large':
          options.scenario.largeWorkspaceCount * options.scenario.panelsPerWorkspace
      },
      runScenario: async () => {
        await processSampler.start()
        try {
          const interactionSummary = await runHighPowerInteractionScenario(page, {
            'Spectrum Benchmark Medium':
              options.scenario.mediumWorkspaceCount *
              Math.max(2, Math.min(options.scenario.panelsPerWorkspace, 3)),
            'Spectrum Benchmark Large':
              options.scenario.largeWorkspaceCount * options.scenario.panelsPerWorkspace
          })
          return {
            interactionSummary,
            probeSummary: summarizeProbeMetrics(await readBenchmarkProbe(page)),
            powerSummary: await processSampler.stop()
          }
        } catch (error) {
          await processSampler.stop()
          throw error
        }
      },
      getExtraMetrics: async () => {
        const appMetrics = await electronApp.evaluate(async ({ app }) => {
          return app.getAppMetrics()
        })
        return {
          electronAppMetrics: summarizeElectronAppMetrics(appMetrics)
        }
      }
    })

    return {
      ...metrics,
      coldStartMs,
      tempHome,
      dbPath
    }
  } finally {
    await electronApp.close()
  }
}

function printModeSummary(result) {
  console.log(`\n[${result.mode}]`)
  console.log(`Cold start: ${formatMs(result.coldStartMs)}`)
  console.log(`Median project open: ${formatMs(result.medianProjectOpenMs)}`)
  console.log(`Average project open: ${formatMs(result.averageProjectOpenMs)}`)

  if (result.largeProjectSnapshot) {
    console.log(
      `Large project snapshot: ${result.largeProjectSnapshot.panelCount} panels, ${result.largeProjectSnapshot.xtermCount} xterm roots, ${result.largeProjectSnapshot.iframeCount} iframes, ${result.largeProjectSnapshot.webviewCount} webviews`
    )
  }

  if (result.rendererMemory?.usedJSHeapSize != null) {
    console.log(
      `Renderer heap used: ${bytesToMiB(result.rendererMemory.usedJSHeapSize).toFixed(1)} MiB`
    )
  } else {
    console.log('Renderer heap used: unavailable')
  }

  if (result.extraMetrics?.electronAppMetrics?.totalWorkingSetMiB != null) {
    console.log(
      `Electron working set: ${result.extraMetrics.electronAppMetrics.totalWorkingSetMiB.toFixed(1)} MiB`
    )
  }

  if (result.scenario?.probeSummary?.frames) {
    console.log(
      `Scenario frame pacing: p99 ${result.scenario.probeSummary.frames.p99FrameTimeMs.toFixed(2)} ms (${result.scenario.probeSummary.frames.p99Fps.toFixed(1)} FPS), avg ${result.scenario.probeSummary.frames.averageFps.toFixed(1)} FPS`
    )
  }

  if (result.scenario?.probeSummary?.input) {
    console.log(
      `Scenario input delay: p99 ${result.scenario.probeSummary.input.inputDelayP99Ms.toFixed(2)} ms, keydown-to-paint p99 ${result.scenario.probeSummary.input.keydownToNextPaintP99Ms.toFixed(2)} ms`
    )
  }

  if (result.scenario?.powerSummary?.totalPower) {
    console.log(
      `Scenario power impact: avg ${result.scenario.powerSummary.totalPower.average.toFixed(2)}, p95 ${result.scenario.powerSummary.totalPower.p95.toFixed(2)}, CPU avg ${result.scenario.powerSummary.totalCpu.average.toFixed(2)}%`
    )
  }

  console.log(
    `Issues: ${result.issues.pageErrors.length} page errors, ${result.issues.consoleErrors.length} console errors, ${result.issues.consoleWarnings.length} console warnings`
  )
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  ensureDirectory(outputDir)

  const results = {
    generatedAt: new Date().toISOString(),
    system: systemInfo(),
    options,
    runs: []
  }

  if (options.mode === 'browser' || options.mode === 'both') {
    results.runs.push(await runBrowserMode(options))
  }

  if (options.mode === 'electron' || options.mode === 'both') {
    results.runs.push(await runElectronMode(options))
  }

  for (const result of results.runs) {
    printModeSummary(result)
  }

  const outputPath =
    options.output ||
    path.join(
      outputDir,
      `benchmark-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`
    )
  fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8')
  console.log(`\nSaved benchmark report to ${outputPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})
