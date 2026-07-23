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
- Excluded link syntax from mirrored selections. Selecting a rendered link label maps to the label text only, dropping the surrounding `[`/`]` brackets and the `(destination)` URL. Task-list links and links whose label is itself inline code (`` [`linked inline code`](url) ``) are handled the same way, composing with the code-delimiter stripping and the list/blockquote line-prefix stripping. As with other spans, a selection that runs from text outside the link into the label still includes the opening `[` that sits between the two runs, which a contiguous source range cannot skip.
- Mirror a preview selection only once the gesture has settled — on mouse release or key release — rather than continuously while a drag is in progress. Reasoning about a single finished `window.getSelection()` state removes a whole class of bugs caused by the transient, intermediate selection states WebKit produces mid-drag (selections that momentarily collapse as the caret crosses word and inline-span boundaries, and anchor placement that does not yet reflect the gesture's intent). A drag that begins in the preview but ends outside the pane (for example dragging past the pane's edge before releasing) is finalized through a document-level mouse-up listener, so it still mirrors.
- Fixed the mirrored selection collapsing to a single space, and the mirror flickering away, when dragging a preview selection backward out of a formatted span (for example double-clicking a word inside `**bold text**` and dragging back into the preceding space). Because only the settled selection is mirrored, the final `·**bold` range maps correctly and no longer degenerates to the inter-word whitespace. This also removed the earlier span-extension heuristic, which over-expanded a settled selection ending exactly at a span's content start (for example selecting only the space before `**bold text**`) to cover the entire span.
- Mirrored a settled preview selection from its rendered range rather than the DOM anchor/focus, using `Selection.getRangeAt(0)` (what is actually rendered as selected) with anchor/focus consulted only to recover the drag direction. This fixed the click-to-deselect case below, but live testing shows it does **not** fully fix double-clicking a word and dragging back to exactly the word's start — that gesture can still leave the word unmirrored; tracked as a known open issue (SM-063).
- Collapsed the mirrored editor selection when a plain click clears a preview selection. Clicking inside rendered, non-editable preview text clears the native selection to nothing (no anchor node), which previously skipped the collapse path and left the old mirrored range selected in the editor. A settle that comes from a preview pointer gesture now collapses the editor selection even when no anchor node remains, while document-wide keyups during ordinary editor typing still leave the editor cursor untouched.
- Decoded HTML entities before mirroring preview selections. `markdownPlainChars` now recognizes an entity reference starting at `&` — named references such as `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&copy;`, `&mdash;`, and `&nbsp;`, plus numeric `&#NNN;`/`&#xHHH;` references — and collapses the whole `&…;` source span onto the single character it renders as, the same way a marker run or code span maps a range of source onto its rendered content. Selecting a rendered entity character, or a run crossing several of them, now mirrors to the exact source entities. A non-breaking space is treated as a visible character rather than collapsible whitespace so it maps one-to-one instead of merging into an adjacent ordinary space, and a bare ampersand that does not begin a recognized reference still falls back to literal handling.
- Stripped the footnote definition label (`[^name]: `) from a footnote body's line prefix. The rendered footnote body omits the label, so leaving it in shifted every body character — and any selection within it — by the label's length. Selecting rendered footnote-body content, including inline code such as `` `footnote_code` ``, now mirrors to the exact source.
- Kept the plain character stream aligned across an inline footnote reference. An inline `[^name]` reference renders as a short marker link (`[1]`) whose width is chosen by the renderer's footnote numbering, not derivable from the source label — previously the label text flowed through as literal content and desynced every character after it in the block. The block's rendered marker widths are now measured from its own DOM (`.footnote-ref` elements' `textContent` length) and passed into `markdownPlainChars`, which reserves exactly that many placeholder characters for each `[^name]` span. Sentence text following an inline footnote reference now mirrors to its exact source; selecting the marker itself remains a best-effort case since its rendered text does not resemble the source label.
- Stripped GFM table structure when mirroring selections. `markdownPlainChars` now drops the `|` cell delimiters and cell padding and skips the entire header separator row (`| --- | :--- | ---: |`, which renders as a rule rather than text), scoped to blocks that actually look like a table so a literal `|` in ordinary prose stays literal. Because the whole `<table>` is a single mapped block, its rendered text is the row-major concatenation of every cell, which now aligns character-for-character with the stripped source. Selecting rendered text within a single table cell — plain, bold, inline code, or link cells, composing with the existing marker/code/link stripping — now mirrors to the exact cell content. A selection spanning two cells still contains the interior `|` between them, the same contiguous-range constraint as other cross-span selections.

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
