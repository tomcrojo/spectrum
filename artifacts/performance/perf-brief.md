# Performance Verification Brief

Date: 2026-04-05
Workspace: /Users/tomascampoy/Documents/spectrum

Original user brief:

> could you verify that the new ui is also highly performant? maybe you could measure p99 fps and input latency to see if we need to improve something from the ui before we make a pr to master.
> first figure out what are good metrics, but i want to be in the top 5% performance.
>
> check also energy usage.
>
> the metrics (measured when doing everything the app is capable of like creating workspaces, opening up panels, switching projects, creating projects, changing project icon, navigating through the structured canvas by scrolling vertically and horizontally with more and less panels open at the same time) to improve without changing the current layout and appearance are:
> - p99 fps (i believe there are apps or chrome extensions that measure this)
> - input lag (ms between when we send a key and when the action starts)
> - battery drain measured with the energy impact that the app is having on the computer, alongside cpu and gpu usage.
>
> all the measurements have to be taken using the high-power mode setting (let's leave the other 2 settings to be optimized later).
>
> if you have any questions before starting, say them now

Additional user requirement:

> i also want you to make the initial prompt into a file so you can reference it after you compact your context

Working interpretation:

- Measure the app in `runtimePowerMode = high`.
- Cover realistic interaction flows, not just startup.
- Prioritize Electron-mode results for release readiness.
- Keep current layout and appearance unchanged; optimize behavior only if metrics show the UI is not competitive.
