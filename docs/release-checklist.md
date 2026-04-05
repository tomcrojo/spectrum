# Release Checklist

Use this before cutting a public alpha build.

## Repo hygiene

- confirm the repo name, app name, and docs all match
- confirm `.gitmodules` is up to date
- confirm `README.md`, `CONTRIBUTING.md`, and `THIRD_PARTY.md` reflect the current state
- confirm no local design exports, generated packaging assets, benchmark artifacts, or machine-specific files are being committed accidentally
- run `git status --short` and make sure only intentional release changes remain

## Verification

- run `npm ci`
- run `npm run build`
- run `npm run dist:mac`
- launch the packaged `.app`
- smoke-test project creation, task CRUD, workspace creation, and browser/T3Code panel startup

## Distribution

- update the version in `package.json`
- attach the DMG to the GitHub release
- clearly label the release as alpha and note current limitations
- mention signing/notarization status in the release notes
- adapt the copy in `docs/announcement-draft.md` for the actual release post
