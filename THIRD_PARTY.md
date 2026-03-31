# Third-Party Components

Spectrum is being built in public and still carries a few embedded or referenced upstream projects. This file makes that explicit.

## Shipped with the app

- `resources/browser-cli`
  Local browser automation helper used by Spectrum browser panels and packaged app builds.

## Development submodules

- `resources/t3code`
  Upstream: <https://github.com/pingdotgg/t3code>
  Used to power the embedded T3Code panel in development.

- `resources/dev-browser`
  Upstream: <https://github.com/SawyerHood/dev-browser>
  Used for browser-driven development and UI inspection workflows.

## Reference submodules

- `resources/idx0`
  Upstream: <https://github.com/galz10/IDX0>
  Retained as an implementation reference while Spectrum evolves.

- `resources/glass`
  Upstream: <https://github.com/Glass-HQ/Glass>
  Retained as an implementation reference while Spectrum evolves.

- `_reference/idx0`
- `_reference/glass`
  Additional pinned snapshots kept for comparison and research. These are not shipped in packaged app builds.

## Notes

- Ownership and licensing for upstream projects remain with their respective authors.
- Public clones should use `git clone --recurse-submodules` so these paths resolve correctly.
- Packaged app builds currently exclude the large reference submodules and ship only the assets Spectrum needs at runtime.
