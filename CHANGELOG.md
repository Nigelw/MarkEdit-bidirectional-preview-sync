# Changelog

## 0.1.0

- Initial best-effort bidirectional scroll sync extension.
- Requires MarkEdit-preview native `syncScroll` to be disabled.
- Uses a shared source lock, cached preview block metadata, and binary-search
  lookup for editor-to-preview and preview-to-editor mapping.
- Changed the default sync reference to the top of the viewport so headings and
  document titles aligned at the top of the editor remain visible in preview.
- Defaults programmatic sync scrolls to smooth behavior in delayed `scrollend`
  mode while keeping continuous sync instant unless `animated` is set explicitly.
- Renamed the timing setting to `syncTiming` with `"afterScroll"` and
  `"whileScrolling"` modes.
- Added an integration signal on `window.__markeditBidirectionalScrollSync__`
  so other extensions can mark intentional preview or editor navigation scrolls.
