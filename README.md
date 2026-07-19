# MarkEdit Bidirectional Scroll Sync

Best-effort bidirectional scroll synchronization for MarkEdit and
[MarkEdit-preview](https://github.com/MarkEdit-app/MarkEdit-preview).

MarkEdit-preview's built-in scroll sync is editor-to-preview only. This extension
owns both directions with one source lock, so preview scrolling can move the
editor without triggering a competing preview correction.

## Requirements

Disable MarkEdit-preview's native sync first:

```json
{
  "extension.markeditPreview": {
    "syncScroll": false
  }
}
```

If `syncScroll` is enabled or unset, this extension refuses to start and shows a
setup warning with a **Disable Sync Scroll** button. That button updates
`settings.json` for you. Quit and reopen MarkEdit afterward so MarkEdit-preview
reloads with sync disabled in every open document. Running both sync systems at
once can cause correction jumps.

When several documents are open, each document may show this setup warning. The
button only updates `settings.json`; it does not relaunch MarkEdit.

## Settings

Optional settings live under `extension.bidirectionalScrollSync`:

```json
{
    "extension.bidirectionalScrollSync": {
      "enabled": true,
      "syncTiming": "afterScroll",
      "referenceRatio": 0,
      "animated": true,
      "showSetupWarning": true
  }
}
```

- `syncTiming`: controls when the paired view updates. The default
  `"afterScroll"` waits for scrolling to finish when the WebKit runtime supports
  `scrollend`; `"whileScrolling"` updates continuously from passive scroll
  events coalesced with `requestAnimationFrame`.
- `referenceRatio`: the viewport band used for mapping between panes. The
  default `0` anchors the top visible editor line to the top of the preview, so
  headings and titles at the top of the editor remain visible in the preview.
- `animated`: use smooth scroll for programmatic sync. When omitted, this
  defaults to `true` for `"afterScroll"` sync and `false` for
  `"whileScrolling"` sync.

The extension watches for MarkEdit-preview's `.markdown-body` pane and
reattaches automatically if it appears later or is replaced. Normal preview mode
changes do not require manual intervention. Settings are read at startup, so
quit and reopen MarkEdit after changing settings.

## Extension Integration

Other extensions can signal intentional navigation scrolls through
`window.__markeditBidirectionalScrollSync__`. Call this immediately before
starting a programmatic scroll so this extension treats that view as the scroll
source and avoids competing corrections while the scroll is in progress:

```js
const sync = window.__markeditBidirectionalScrollSync__;
sync?.beginPreviewScroll?.({ animated: true });
previewPane.scrollTo({ top, behavior: 'smooth' });
```

Available methods:

- `beginPreviewScroll({ animated })`: the preview is about to scroll because of
  external navigation, such as an outline/sidebar click.
- `beginEditorScroll({ animated })`: the editor is about to scroll because of
  external navigation.
- `beginScroll(source, { animated })`: generic form where `source` is
  `"preview"` or `"editor"`.

Set `animated` to match the scroll you are about to start. Smooth scrolls hold
the source lock until `scrollend` when available, with a timeout fallback; instant
scrolls release quickly.

## Development

```sh
npm install
npm run typecheck
npm run build
```

The build uses `markedit-vite` to output a single CommonJS user script and copy
it into MarkEdit's scripts folder.
