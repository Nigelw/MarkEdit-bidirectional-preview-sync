# AGENTS.md

Developer and architecture notes for the MarkEdit Bidirectional Preview Sync extension. The [README](README.md) is the user-facing overview and guide; this file is for people and agents working on the code.

## Development

```sh
npm install
npm run build
npm run reload
npm run typecheck
```

The build ([`vite.config.mts`](vite.config.mts)) uses [`markedit-vite`](https://github.com/MarkEdit-app/MarkEdit-vite), which externalizes `markedit-api` and CodeMirror modules so they resolve to MarkEdit's own live instances at runtime, emits a single CommonJS file into `dist/`, and copies it into `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/`.

`dist/` contains the generated release bundle. Each release commits `dist/markedit-bidirectional-preview-sync.js` and attaches the same file as an asset for manual installation and registry distribution.

## How It Works

- **Startup** creates one `BidirectionalPreviewSync` controller, installs the Extensions menu, and starts syncing once the editor is ready.
- **Setup gating** refuses to run when MarkEdit-preview's native `syncScroll` is enabled or unset, because running both sync systems can cause correction jumps.
- **Scroll mapping** caches preview block metadata and uses editor line positions plus binary-search lookup to translate between editor and preview scroll positions.
- **Source locking** marks the actively-scrolled pane so the paired sync does not immediately fight the user's current scroll or an intentional navigation scroll.

Updates are managed by MarkEdit's Extension Manager rather than by the extension itself.

## Project Layout

```text
main.ts                Entry point: menu and controller bootstrap
src/sync.ts            Bidirectional editor/preview sync controller
src/previewBlocks.ts   Preview block collection and mapping helpers
src/menu.ts            Extensions-menu commands
src/settings.ts        Read and validate settings from settings.json
src/settingsFile.ts    Read/write settings.json
src/constants.ts       Shared names, settings keys, and repo/release URLs
```

## Releases

Releases are cut with the **`release` skill** (`.agents/skills/release/SKILL.md`). It bumps the version, updates `CHANGELOG.md`, rebuilds, commits, tags `vX.Y.Z`, pushes, and publishes a GitHub release with `dist/markedit-bidirectional-preview-sync.js` attached as an asset.

For a release to be installable, all of these must agree:

1. `package.json` `version` = the new version.
2. `dist/markedit-bidirectional-preview-sync.js` is freshly rebuilt from that version.
3. The `vX.Y.Z` GitHub release has a `markedit-bidirectional-preview-sync.js` asset that is exactly that freshly-built bundle.

Registry entries should point at the committed bundle through the immutable raw URL for the matching release tag.

The repo must stay public for unauthenticated release-asset and registry fetches to work.

Registry submissions use the submit-registry skill at .agents/skills/submit-registry/SKILL.md. It verifies the latest tagged bundle, prepares the registry JSON and PR body for user review, validates the registry entry, and opens a draft PR only after approval.
