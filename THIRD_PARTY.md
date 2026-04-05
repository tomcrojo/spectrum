# Third-Party Components

Spectrum is being built in public and still carries a few embedded or referenced upstream projects. This file makes that explicit.

## Shipped with the app

- `resources/browser-cli`
  Local browser automation helper used by Spectrum browser panels and packaged app builds.

## Development submodules

- `resources/t3code`
  Upstream: <https://github.com/pingdotgg/t3code>
  Used to power the embedded T3Code panel in development and release packaging.

## Notes

- Ownership and licensing for upstream projects remain with their respective authors.
- Public clones should use `git clone --recurse-submodules` so these paths resolve correctly.
- Packaged app builds generate `build/t3code-runtime/` locally and ship only the assets Spectrum needs at runtime.
- Spectrum still acknowledges projects like IDX0, Glass, and dev-browser as design or workflow inspiration, but they are no longer vendored into this repository.
