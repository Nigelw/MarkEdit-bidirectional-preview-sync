# AGENTS.md

Developer and architecture notes for the MarkEdit Bidirectional Preview Sync extension. The [README](README.md) is the user-facing overview and guide; this file is for people and agents working on the code.

## Development

```sh
npm install
npm run build
npm run reload
npm run typecheck
```

The build ([`vite.config.mts`](vite.config.mts)) uses [`markedit-vite`](https://github.com/MarkEdit-app/MarkEdit-vite), which externalizes `markedit-api` and CodeMirror modules so they resolve to MarkEdit's own live instances at runtime, emits a single CommonJS file into `dist/`, and copies it into `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/`. It also injects `package.json`'s `version` as the `__EXTENSION_VERSION__` global (declared in [`src/globals.d.ts`](src/globals.d.ts)) for the updater.

`dist/` is a build artifact, not source. Each release attaches `dist/markedit-bidirectional-preview-sync.js` as an asset, which is both what users download to install and what the updater fetches.

## How It Works

- **Startup** creates one `BidirectionalPreviewSync` controller, installs the Extensions menu, schedules the updater, and starts syncing once the editor is ready.
- **Setup gating** refuses to run when MarkEdit-preview's native `syncScroll` is enabled or unset, because running both sync systems can cause correction jumps.
- **Scroll mapping** caches preview block metadata and uses editor line positions plus binary-search lookup to translate between editor and preview scroll positions.
- **Source locking** marks the actively-scrolled pane so the paired sync does not immediately fight the user's current scroll or an intentional navigation scroll.
- **The updater** ([`src/updater.ts`](src/updater.ts)) runs on `onAppReady` and on demand from the menu. It fetches `releases/latest` from the GitHub API, compares the release tag against the baked-in `__EXTENSION_VERSION__`, and installs according to the `update` setting. Installing finds the release asset named `markedit-bidirectional-preview-sync.js`, downloads it, and overwrites the running script file via `MarkEdit.createFile`.

## Project Layout

```text
main.ts                Entry point: menu, updater kickoff, controller bootstrap
src/sync.ts            Bidirectional editor/preview sync controller
src/previewBlocks.ts   Preview block collection and mapping helpers
src/menu.ts            Extensions-menu commands
src/settings.ts        Read and validate settings from settings.json
src/settingsFile.ts    Read/write settings.json
src/updater.ts         Check GitHub releases and self-install new builds
src/constants.ts       Shared names, settings keys, repo/update URLs
src/globals.d.ts       Ambient declaration for __EXTENSION_VERSION__
```

## Releases

Releases are cut with the **`release` skill** (`.agents/skills/release/SKILL.md`). It bumps the version, updates `CHANGELOG.md`, rebuilds, commits, tags `vX.Y.Z`, pushes, and publishes a GitHub release with `dist/markedit-bidirectional-preview-sync.js` attached as an asset.

The updater downloads the release asset named `markedit-bidirectional-preview-sync.js` from the latest GitHub release. For a release to be installable, all of these must agree:

1. `package.json` `version` = the new version baked into the bundle.
2. `dist/markedit-bidirectional-preview-sync.js` is freshly rebuilt from that version.
3. The `vX.Y.Z` GitHub release has a `markedit-bidirectional-preview-sync.js` asset that is exactly that freshly-built bundle.

The repo must stay public for unauthenticated GitHub API and release-asset fetches to work.
