# MarkEdit Bidirectional Preview Sync

Keeps [MarkEdit](https://github.com/MarkEdit-app/MarkEdit)’s editor and preview panes synchronized as you switch and scroll between them.

[MarkEdit-preview](https://github.com/MarkEdit-app/MarkEdit-preview) can keep the preview aligned as you edit, but it doesn't move the editor when you scroll the preview. This extension keeps both panes aligned, so you can move naturally between reading the rendered document and editing the source.

This is particularly useful when proofreading in preview mode. When you spot an error, switching back to the editor takes you to the text you were just reading instead of making you hunt for it again. The preview-to-editor mapping doesn't need to be perfect to remove friction from this workflow; it just needs to be good. This extension easily clears that bar. It also plays nicely with my [Outline Sidebar](https://github.com/Nigelw/MarkEdit-outline-sidebar) extension.

![MarkEdit Bidirectional Preview Sync demo](assets/screenrecording2.gif)

**[Download the latest release](https://github.com/Nigelw/MarkEdit-bidirectional-preview-sync/releases/latest/download/markedit-bidirectional-preview-sync.js)** then see [Install](#install) below.

## Install

1. Download `markedit-bidirectional-preview-sync.js` from the [latest GitHub release](https://github.com/Nigelw/MarkEdit-bidirectional-preview-sync/releases/latest).
2. Move it into MarkEdit's scripts folder: `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/`
3. Quit and reopen MarkEdit.

## Requirements

MarkEdit-preview's native scroll sync must be disabled before this extension can run. (Running both sync systems at once would cause correction jumps.) If native sync is enabled, this extension disables itself and shows a setup warning with a **Disable Sync Scroll** button. Click that button to let the extension update `settings.json` for you, then quit and reopen MarkEdit so MarkEdit-preview reloads with sync disabled in every open document.

If you prefer to make the change manually, set MarkEdit-preview's `syncScroll` option to `false`:

```json
{
  "extension.markeditPreview": {
    "syncScroll": false
  }
}
```

## Settings

Use *Extensions -> Bidirectional Preview Sync -> Sync After Scrolling Stops* or *Sync While Scrolling* to change `syncTiming` from the extension's menu without relaunching MarkEdit.

Settings can also be edited manually under `extension.bidirectionalPreviewSync`:

```json
{
    "extension.bidirectionalPreviewSync": {
      "syncTiming": "afterScroll",
      "referenceRatio": 0,
      "update": "notify"
  }
}
```

- `syncTiming`: controls when the paired view updates. The default `"afterScroll"` waits for scrolling to settle; `"whileScrolling"` updates continuously from passive scroll events coalesced with `requestAnimationFrame`.
- `referenceRatio`: the viewport band used for mapping between panes. The default `0` anchors the top visible editor line to the top of the preview, so headings and titles at the top of the editor remain visible in the preview.
- `update`: controls GitHub update checks. Use `"notify"` to ask before installing, `"automatic"` to download newer releases silently and prompt for a restart, or `"never"` to disable automatic checks.

Settings edited manually in `settings.json` are read at startup, so quit and reopen MarkEdit after changing them outside this extension's menu.

## Staying Up To Date

The extension checks its [GitHub releases](https://github.com/Nigelw/MarkEdit-bidirectional-preview-sync/releases) for a newer version shortly after MarkEdit launches, at most once a week. You can also run *Extensions -> Bidirectional Preview Sync -> Check for Updates...* at any time. When a newer release is found, the extension downloads the release asset named `markedit-bidirectional-preview-sync.js` and replaces its own installed script file; the new version takes effect after restarting MarkEdit.

## Extension Integration

Other extensions can signal intentional navigation scrolls through `window.__markeditBidirectionalPreviewSync__`. Call this immediately before starting programmatic navigation so this extension treats that view as the scroll source and avoids competing corrections while the scroll is in progress:

```js
const sync = window.__markeditBidirectionalPreviewSync__;
sync?.beginEditorScroll?.({ animated: true });
view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start' }) });
```

Available methods:

- `beginPreviewScroll({ animated })`: the preview is about to scroll because of external navigation.
- `beginEditorScroll({ animated })`: the editor is about to scroll because of external navigation, such as an outline/sidebar click.
- `beginScroll(source, { animated })`: generic form where `source` is `"preview"` or `"editor"`.

Set `animated` to the behavior the paired sync scroll should use. This lets a navigation extension request smooth preview movement even when this extension is using `"whileScrolling"` sync. Smooth source locks use a longer timeout; instant locks release quickly.

## Development

```sh
npm install
npm run typecheck
npm run build
```

The build uses `markedit-vite` to output a single CommonJS user script and copy it into MarkEdit's scripts folder. Developer notes and the release process live in [AGENTS.md](AGENTS.md).
