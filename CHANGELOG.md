# Changelog

## 1.1.0 (2026-07-24)

### New

- Added an experimental "Mirror Preview Selection" feature
  - Selecting text in the preview now also selects the matching Markdown source in the editor, so you can jump straight from spotting a mistake to fixing it.
  - This is explicitly not an attempt to progress to WYSIWYG editing, it’s simply a speedup of a common workflow.
  - This feature has quirks and limitations. See the project README.md for details.
  - Off by default; enable it from *Extensions → Bidirectional Preview Sync → Experimental Features*.

## 1.0.3 (2026-07-22)

### Improved

- Adds a menu item for opening the release notes on GitHub.

## 1.0.2 (2026-07-20)

### Improved

- Clarified the first-run setup alert so it's easier to understand how to disable MarkEdit-preview's built-in sync.

## 1.0.1 (2026-07-19)

### Fixed

- Removed obsolete settings and updated documentation

## 1.0.0 (2026-07-19)

Initial release

## 0.1.0 (2026-07-19)

- Initial best-effort bidirectional preview sync extension.
- Requires MarkEdit-preview native `syncScroll` to be disabled.
- Uses a shared source lock, cached preview block metadata, and binary-search
  lookup for editor-to-preview and preview-to-editor mapping.
- Changed the default sync reference to the top of the viewport so headings and
  document titles aligned at the top of the editor remain visible in preview.
- Defaults programmatic sync scrolls to smooth behavior in delayed `scrollend`
  mode while keeping continuous sync instant unless `animated` is set explicitly.
- Renamed the timing setting to `syncTiming` with `"afterScroll"` and
  `"whileScrolling"` modes.
- Added an integration signal on `window.__markeditBidirectionalPreviewSync__`
  so other extensions can mark intentional preview or editor navigation scrolls.
- Changed `"afterScroll"` timing to wait for scroll events to settle instead of
  relying on native `scrollend`, so inertial scrolling can finish before sync.
- Integration scroll signals can now override the paired sync animation for that
  navigation, including smooth outline navigation while using `"whileScrolling"`.
- Added menu items to switch between syncing after scrolling stops and syncing
  while scrolling without relaunching MarkEdit.
