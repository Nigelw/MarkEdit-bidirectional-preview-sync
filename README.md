# MarkEdit Bidirectional Preview Sync

Best-effort bidirectional preview synchronization for MarkEdit and
[MarkEdit-preview](https://github.com/MarkEdit-app/MarkEdit-preview).

**[Download the latest release](https://github.com/Nigelw/MarkEdit-bidirectional-preview-sync/releases/latest/download/markedit-bidirectional-preview-sync.js)** then see [Install](#install) below.

MarkEdit-preview's built-in scroll sync is editor-to-preview only. This extension
owns both directions with one source lock, so preview scrolling can move the
editor without triggering a competing preview correction.

## Install

1. Download `markedit-bidirectional-preview-sync.js` from the
   [latest GitHub release](https://github.com/Nigelw/MarkEdit-bidirectional-preview-sync/releases/latest).
2. Move it into MarkEdit's scripts folder:
   `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/`
3. Quit and reopen MarkEdit.

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

Optional settings live under `extension.bidirectionalPreviewSync`:

```json
{
    "extension.bidirectionalPreviewSync": {
      "enabled": true,
      "syncTiming": "afterScroll",
      "referenceRatio": 0,
      "animated": true,
      "showSetupWarning": true,
      "update": "notify"
  }
}
```

- `syncTiming`: controls when the paired view updates. The default
  `"afterScroll"` waits for scrolling to settle; `"whileScrolling"` updates
  continuously from passive scroll events coalesced with `requestAnimationFrame`.
- `referenceRatio`: the viewport band used for mapping between panes. The
  default `0` anchors the top visible editor line to the top of the preview, so
  headings and titles at the top of the editor remain visible in the preview.
- `animated`: use smooth scroll for programmatic sync. When omitted, this
  defaults to `true` for `"afterScroll"` sync and `false` for
  `"whileScrolling"` sync.
- `update`: controls GitHub update checks. Use `"notify"` to ask before
  installing, `"automatic"` to download newer releases silently and prompt for a
  restart, or `"never"` to disable automatic checks.

You can switch `syncTiming` without relaunching MarkEdit from
*Extensions -> Bidirectional Preview Sync -> Sync After Scrolling Stops* or
*Sync While Scrolling*.

The extension watches for MarkEdit-preview's `.markdown-body` pane and
reattaches automatically if it appears later or is replaced. Normal preview mode
changes do not require manual intervention. Settings edited manually in
`settings.json` are read at startup, so quit and reopen MarkEdit after changing
them outside this extension's menu.

## Staying Up To Date

The extension checks its
[GitHub releases](https://github.com/Nigelw/MarkEdit-bidirectional-preview-sync/releases)
for a newer version shortly after MarkEdit launches, at most once a week. You can
also run *Extensions -> Bidirectional Preview Sync -> Check for Updates...* at any
time. When a newer release is found, the extension downloads the release asset
named `markedit-bidirectional-preview-sync.js` and replaces its own installed
script file; the new version takes effect after restarting MarkEdit.

The menu also includes *Visit GitHub Project* for opening the repository page in
your default browser.

## Extension Integration

Other extensions can signal intentional navigation scrolls through
`window.__markeditBidirectionalPreviewSync__`. Call this immediately before
starting programmatic navigation so this extension treats that view as the
scroll source and avoids competing corrections while the scroll is in progress:

```js
const sync = window.__markeditBidirectionalPreviewSync__;
sync?.beginEditorScroll?.({ animated: true });
view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start' }) });
```

Available methods:

- `beginPreviewScroll({ animated })`: the preview is about to scroll because of
  external navigation.
- `beginEditorScroll({ animated })`: the editor is about to scroll because of
  external navigation, such as an outline/sidebar click.
- `beginScroll(source, { animated })`: generic form where `source` is
  `"preview"` or `"editor"`.

Set `animated` to the behavior the paired sync scroll should use. This lets a
navigation extension request smooth preview movement even when this extension is
configured for `"whileScrolling"` sync. Smooth source locks use a longer timeout;
instant locks release quickly.

## Development

```sh
npm install
npm run typecheck
npm run build
```

The build uses `markedit-vite` to output a single CommonJS user script and copy
it into MarkEdit's scripts folder. Developer notes and the release process live
in [AGENTS.md](AGENTS.md).
