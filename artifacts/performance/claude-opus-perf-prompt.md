# Spectrum Performance Review Request

You are reviewing the Spectrum Electron app codebase for performance and energy usage.

Constraints:

- Do not change visible layout, appearance, interaction model, UX, or feature set.
- Any optimization must preserve current functionality and behavior.
- Focus on renderer smoothness, input responsiveness, and battery/power efficiency.
- The target runtime mode is `high` power mode only.
- The current benchmark is Electron-mode, high-power, using a realistic interaction scenario:
  - create workspaces
  - open panels
  - switch projects
  - create projects
  - change project icon
  - navigate the structured canvas vertically and horizontally with different panel counts open

Latest measured results:

```json
{
  "coldStartMs": 4301,
  "medianProjectOpenMs": 232,
  "rendererHeapMiB": 98.2,
  "workingSetMiB": 840.8,
  "frameMetrics": {
    "frameCount": 2942,
    "estimatedRefreshHz": 59.9,
    "averageFps": 59.5,
    "p95FrameTimeMs": 18.2,
    "p99FrameTimeMs": 18.6,
    "p99Fps": 53.8,
    "longFramesOver50Ms": 6,
    "droppedFramesOver2xRefresh": 6
  },
  "inputMetrics": {
    "observedEventCount": 143,
    "inputDelayP95Ms": 1.49,
    "inputDelayP99Ms": 2.06,
    "keydownInputDelayP95Ms": 0.2,
    "keydownInputDelayP99Ms": 0.69,
    "inputToNextPaintP95Ms": 15.75,
    "inputToNextPaintP99Ms": 17.4,
    "keydownToNextPaintP95Ms": 15.8,
    "keydownToNextPaintP99Ms": 17.4
  },
  "longTasks": {
    "count": 2,
    "totalDurationMs": 244,
    "p95DurationMs": 128.3,
    "p99DurationMs": 128.86,
    "maxDurationMs": 129
  },
  "powerSummary": {
    "sampleCount": 29,
    "totalPower": {
      "average": 11.92,
      "p95": 35.54,
      "max": 59.7
    },
    "totalCpu": {
      "average": 9.89,
      "p95": 33.44,
      "max": 59.7
    },
    "totalIdleWakeupsPerSecond": {
      "average": 217.86,
      "p95": 341.6,
      "max": 355
    },
    "gpuProcess": {
      "cpuAverage": 1.79,
      "cpuMax": 8,
      "powerAverage": 2.66,
      "powerMax": 8.9
    }
  }
}
```

Known benchmark warning:

- `Warning: Missing Description or aria-describedby={undefined} for DialogContent.`

Files likely relevant:

- `src/renderer/src/components/canvas/Canvas.tsx`
- `src/renderer/src/components/canvas/WorkspacePanel.tsx`
- `src/renderer/src/components/canvas/BrowserRuntimeHost.tsx`
- `src/renderer/src/components/canvas/BrowserPanel.tsx`
- `src/renderer/src/components/canvas/T3CodePanel.tsx`
- `src/renderer/src/components/canvas/FilePanel.tsx`
- `src/renderer/src/stores/workspaces.store.ts`
- `src/renderer/src/stores/panel-runtime.store.ts`
- `src/renderer/src/components/project/WorkspaceList.tsx`
- `src/renderer/src/components/layout/Sidebar.tsx`

Please inspect the codebase and answer with:

1. The top optimization opportunities that are still available.
2. Which ones are most likely to improve p99 frame time and which ones are most likely to reduce power usage.
3. Which opportunities are low-risk and preserve current UX exactly.
4. Specific file/function-level references.
5. A ranked recommendation list with expected impact and implementation risk.

Avoid generic Electron advice unless it clearly applies to this codebase.
