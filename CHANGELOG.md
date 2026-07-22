# Changelog

## Unreleased

### Added

- Added preview-selection mirroring so selecting rendered preview text selects the matching Markdown source in the editor.
- Added a hot-reloaded `mirrorPreviewSelection` setting and menu toggle.
- Collapsing a mirrored preview text selection now collapses the editor selection to the start of the mirrored source selection.

### Fixed

- Preserved whitespace selected in the preview when mirroring to the editor. Rendered offsets now map directly to source characters instead of a whitespace-collapsed stream, so paragraph-edge whitespace and the leading space before a styled span are no longer trimmed from the mirrored source selection.
- Excluded inline formatting markers from mirrored selections at span boundaries. Selecting rendered bold, italic, bold italic, inline code, or strikethrough now maps to the content only, dropping the surrounding `**`, `__`, `*`, `_`, `***`, `` ` ``, and `~~` wrappers. Each selection endpoint now resolves to the leading source position when it is the start of the selection and the trailing position when it is the end, so closing markers no longer leak in.
- Treated inline code contents literally so characters like `_` and `*` inside `` `inline_code` `` are preserved instead of being mistaken for emphasis markers.
- Fixed the mirrored selection collapsing to a single space when dragging a preview selection backward out of a formatted span. When the selection's upper boundary sits exactly at the content start of an inline span the user is selecting into (for example after double-clicking a word inside `**bold**` and dragging back past its start), the boundary no longer lands before the stripped opening markers and degenerates the range to just the inter-word whitespace; it now extends to the span's content so the mirror includes the span. Selections that only touch the span boundary from outside are unaffected, so the leading-space-before-a-span behavior is preserved.
- Kept the mirrored editor selection stable during a preview drag instead of momentarily clearing it. The preview selection briefly collapses as the caret crosses word and inline-span boundaries mid-drag; the mirror now ignores those transient collapses until the pointer is released, so the editor selection no longer flickers away as the drag passes the start of a word.

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
