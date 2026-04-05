# Third-Party Components

Spectrum is being built in public and still carries a few embedded or referenced upstream projects. This file makes that explicit.

## Shipped with the app

- `resources/browser-cli`
  Local browser automation helper used by Spectrum browser panels and packaged app builds.

## Development submodules

- `resources/t3code`
  Upstream: <https://github.com/pingdotgg/t3code>
  Used to power the embedded T3Code panel in development and release packaging.

- `resources/dev-browser`
  Upstream: <https://github.com/SawyerHood/dev-browser>
  Used for browser-driven development and UI inspection workflows.

## Notes

- Ownership and licensing for upstream projects remain with their respective authors.
- Public clones should use `git clone --recurse-submodules` so these paths resolve correctly.
- Packaged app builds generate `build/t3code-runtime/` locally and ship only the assets Spectrum needs at runtime.
- Spectrum still acknowledges projects like IDX0 and Glass as design inspiration, but they are no longer vendored into this repository.
