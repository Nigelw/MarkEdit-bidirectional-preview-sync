import { EditorView } from '@codemirror/view';
import { MarkEdit } from 'markedit-api';

import { PreviewBlockIndex, type BlockEntry } from './previewBlocks';
import { previewSelectionToEditorSelection } from './previewSelection';
import { loadSettings, markEditPreviewSyncScrollDisabled, PREVIEW_SETTINGS_NAMESPACE, settingsObject } from './settings';
import type { Settings, SyncTiming } from './settings';
import { readSettings, writeSettings } from './settingsFile';

type SyncSource = 'editor' | 'preview' | 'none';
type IntegrationScrollSource = Exclude<SyncSource, 'none'>;
type IntegrationScrollOptions = {
  animated?: boolean;
};
type Disposable = () => void;
type SourceAnimationOverride = {
  source: IntegrationScrollSource;
  animated: boolean;
};
type IntegrationState = {
  isActive?: boolean;
  beginScroll?: (source: IntegrationScrollSource, options?: IntegrationScrollOptions) => void;
  beginPreviewScroll?: (options?: IntegrationScrollOptions) => void;
  beginEditorScroll?: (options?: IntegrationScrollOptions) => void;
};

declare global {
  interface Window {
    __markeditBidirectionalPreviewSync__?: IntegrationState;
  }
}

const PREVIEW_SELECTOR = '.markdown-body';
const LOCK_RELEASE_MS = 180;
const SCROLL_SETTLE_MS = 220;
const SMOOTH_LOCK_RELEASE_MS = 1200;

export class BidirectionalPreviewSync {
  private settings: Settings = loadSettings();
  private readonly blockIndex = new PreviewBlockIndex();
  private disposables: Disposable[] = [];
  private scrollDisposables: Disposable[] = [];
  private selectionDisposables: Disposable[] = [];
  private editorFrame: number | undefined;
  private previewFrame: number | undefined;
  private selectionFrame: number | undefined;
  private attachFrame: number | undefined;
  private attachedPreviewPane: HTMLElement | undefined;
  private waitingForPreviewLogged = false;
  private nativeSyncAlertShown = false;
  private source: SyncSource = 'none';
  private sourceAnimationOverride: SourceAnimationOverride | undefined;
  private releaseTimer: ReturnType<typeof setTimeout> | undefined;
  private releaseScrollEndDispose: Disposable | undefined;
  private started = false;

  start(): void {
    this.stop();
    this.settings = loadSettings();

    if (!markEditPreviewSyncScrollDisabled()) {
      void this.warnAboutNativeSync();
      return;
    }

    this.observePreviewPane();
    this.attachCurrentPreviewPane();
  }

  stop(): void {
    for (const dispose of this.disposables.splice(0)) {
      dispose();
    }
    this.detachScrollListeners();
    this.detachSelectionListeners();

    if (this.editorFrame !== undefined) {
      cancelAnimationFrame(this.editorFrame);
      this.editorFrame = undefined;
    }
    if (this.previewFrame !== undefined) {
      cancelAnimationFrame(this.previewFrame);
      this.previewFrame = undefined;
    }
    if (this.selectionFrame !== undefined) {
      cancelAnimationFrame(this.selectionFrame);
      this.selectionFrame = undefined;
    }
    if (this.attachFrame !== undefined) {
      cancelAnimationFrame(this.attachFrame);
      this.attachFrame = undefined;
    }
    this.clearSourceLock();

    this.blockIndex.detach();
    this.attachedPreviewPane = undefined;
    this.waitingForPreviewLogged = false;
    this.nativeSyncAlertShown = false;
    this.started = false;
    this.publishIntegration(false);
  }

  showSetupStatus(): void {
    const previewPane = this.findPreviewPane();
    const nativeDisabled = markEditPreviewSyncScrollDisabled();

    void MarkEdit.showAlert({
      title: 'Bidirectional Preview Sync',
      message: [
        `Extension status: ${this.started ? 'running' : 'not running'}.`,
        `MarkEdit-preview pane: ${previewPane === undefined ? 'not found' : 'found'}.`,
        `MarkEdit-preview syncScroll: ${nativeDisabled ? 'disabled' : 'enabled or unset'}.`,
        '',
        nativeDisabled
          ? 'Setup is ready. Preview mode changes are detected automatically.'
          : `Set "${PREVIEW_SETTINGS_NAMESPACE}.syncScroll" to false, then quit and reopen MarkEdit.`,
      ].join('\n'),
      buttons: ['OK'],
    });
  }

  reloadSettings(): void {
    this.settings = loadSettings();

    if (!markEditPreviewSyncScrollDisabled()) {
      this.stop();
      void this.warnAboutNativeSync();
      return;
    }

    if (!this.started) {
      this.start();
      return;
    }

    const previewPane = this.attachedPreviewPane;
    if (previewPane === undefined) {
      this.attachCurrentPreviewPane();
      return;
    }

    this.detachScrollListeners();
    this.detachSelectionListeners();
    this.clearSourceLock();
    this.attachScrollListeners(MarkEdit.editorView.scrollDOM, previewPane);
    this.attachSelectionListeners(previewPane);
  }

  syncTiming(): SyncTiming {
    return this.settings.syncTiming;
  }

  mirrorPreviewSelection(): boolean {
    return this.settings.mirrorPreviewSelection;
  }

  private observePreviewPane(): void {
    const target = document.body ?? document.documentElement;
    const observer = new MutationObserver(() => this.scheduleAttachCurrentPreviewPane());
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    this.disposables.push(() => observer.disconnect());
  }

  private scheduleAttachCurrentPreviewPane(): void {
    if (this.attachFrame !== undefined) {
      return;
    }

    this.attachFrame = requestAnimationFrame(() => {
      this.attachFrame = undefined;
      this.attachCurrentPreviewPane();
    });
  }

  private attachCurrentPreviewPane(): void {
    const previewPane = this.findPreviewPane();
    if (previewPane === undefined) {
      if (this.started) {
        this.detachScrollListeners();
        this.blockIndex.detach();
        this.attachedPreviewPane = undefined;
        this.started = false;
        this.publishIntegration(false);
      }
      if (!this.waitingForPreviewLogged) {
        console.warn('[Bidirectional Preview Sync] MarkEdit-preview pane not found; waiting for it to appear.');
        this.waitingForPreviewLogged = true;
      }
      return;
    }

    if (this.attachedPreviewPane === previewPane && this.started) {
      return;
    }

    this.detachScrollListeners();
    this.detachSelectionListeners();
    this.blockIndex.attach(previewPane);
    this.attachScrollListeners(MarkEdit.editorView.scrollDOM, previewPane);
    this.attachSelectionListeners(previewPane);
    this.attachedPreviewPane = previewPane;
    this.waitingForPreviewLogged = false;
    this.started = true;
    this.publishIntegration(true);
    console.info('[Bidirectional Preview Sync] Attached to MarkEdit-preview pane.');
  }

  private detachScrollListeners(): void {
    for (const dispose of this.scrollDisposables.splice(0)) {
      dispose();
    }

    if (this.editorFrame !== undefined) {
      cancelAnimationFrame(this.editorFrame);
      this.editorFrame = undefined;
    }
    if (this.previewFrame !== undefined) {
      cancelAnimationFrame(this.previewFrame);
      this.previewFrame = undefined;
    }
  }

  private detachSelectionListeners(): void {
    for (const dispose of this.selectionDisposables.splice(0)) {
      dispose();
    }

    if (this.selectionFrame !== undefined) {
      cancelAnimationFrame(this.selectionFrame);
      this.selectionFrame = undefined;
    }
  }

  private attachScrollListeners(editorScroller: HTMLElement, previewPane: HTMLElement): void {
    const editorHandler = () => {
      if (this.source === 'preview') {
        return;
      }
      this.scheduleEditorSync(editorScroller, previewPane);
    };

    const previewHandler = () => {
      if (this.source === 'editor') {
        return;
      }
      this.schedulePreviewSync(editorScroller, previewPane);
    };

    this.addScrollListener(editorScroller, editorHandler);
    this.addScrollListener(previewPane, previewHandler);
  }

  private attachSelectionListeners(previewPane: HTMLElement): void {
    if (!this.settings.mirrorPreviewSelection) {
      return;
    }

    const handler = () => this.schedulePreviewSelectionMirror(previewPane);
    document.addEventListener('selectionchange', handler);
    previewPane.addEventListener('mouseup', handler);
    previewPane.addEventListener('keyup', handler);
    this.selectionDisposables.push(() => {
      document.removeEventListener('selectionchange', handler);
      previewPane.removeEventListener('mouseup', handler);
      previewPane.removeEventListener('keyup', handler);
    });
  }

  private addScrollListener(element: HTMLElement, handler: () => void): void {
    if (this.settings.syncTiming === 'afterScroll') {
      let settleTimer: ReturnType<typeof setTimeout> | undefined;
      const settledHandler = () => {
        if (settleTimer !== undefined) {
          clearTimeout(settleTimer);
        }
        settleTimer = setTimeout(() => {
          settleTimer = undefined;
          handler();
        }, SCROLL_SETTLE_MS);
      };

      element.addEventListener('scroll', settledHandler, { passive: true });
      this.scrollDisposables.push(() => {
        if (settleTimer !== undefined) {
          clearTimeout(settleTimer);
        }
        element.removeEventListener('scroll', settledHandler);
      });
      return;
    }

    element.addEventListener('scroll', handler, { passive: true });
    this.scrollDisposables.push(() => element.removeEventListener('scroll', handler));
  }

  private scheduleEditorSync(editorScroller: HTMLElement, previewPane: HTMLElement): void {
    if (this.editorFrame !== undefined) {
      cancelAnimationFrame(this.editorFrame);
    }

    this.editorFrame = requestAnimationFrame(() => {
      this.editorFrame = undefined;
      if (this.source === 'preview') {
        return;
      }
      this.syncEditorToPreview(editorScroller, previewPane);
    });
  }

  private schedulePreviewSync(editorScroller: HTMLElement, previewPane: HTMLElement): void {
    if (this.previewFrame !== undefined) {
      cancelAnimationFrame(this.previewFrame);
    }

    this.previewFrame = requestAnimationFrame(() => {
      this.previewFrame = undefined;
      if (this.source === 'editor') {
        return;
      }
      this.syncPreviewToEditor(editorScroller, previewPane);
    });
  }

  private schedulePreviewSelectionMirror(previewPane: HTMLElement): void {
    if (this.selectionFrame !== undefined) {
      cancelAnimationFrame(this.selectionFrame);
    }

    this.selectionFrame = requestAnimationFrame(() => {
      this.selectionFrame = undefined;
      this.mirrorPreviewSelectionToEditor(previewPane);
    });
  }

  private mirrorPreviewSelectionToEditor(previewPane: HTMLElement): void {
    const selection = window.getSelection();
    if (selection === null) {
      return;
    }

    const mapped = previewSelectionToEditorSelection(
      selection,
      previewPane,
      this.blockIndex.all(),
      MarkEdit.editorView.state.doc,
    );
    if (mapped === undefined) {
      return;
    }

    MarkEdit.editorView.dispatch({
      selection: mapped.selection,
      effects: EditorView.scrollIntoView(mapped.range, { y: 'nearest' }),
    });
  }

  private syncEditorToPreview(editorScroller: HTMLElement, previewPane: HTMLElement): void {
    const target = this.editorReference();
    const position = this.previewPositionForLine(target.line, target.progress);
    if (position === undefined) {
      return;
    }

    const desired = clamp(position - this.previewReferenceOffset(previewPane), 0, maxScrollTop(previewPane));
    if (Math.abs(previewPane.scrollTop - desired) < 1) {
      return;
    }

    this.withSource('editor', () => {
      const animated = this.animatedForSyncFrom('editor');
      scrollElementTo(previewPane, desired, animated);
      this.releaseSourceAfterScroll(previewPane, animated);
    });
  }

  private syncPreviewToEditor(editorScroller: HTMLElement, previewPane: HTMLElement): void {
    const line = this.previewReferenceLine(previewPane);
    if (line === undefined) {
      return;
    }

    const desired = this.editorScrollTopForLine(line);
    if (desired === undefined || Math.abs(editorScroller.scrollTop - desired) < 1) {
      return;
    }

    this.withSource('preview', () => {
      const animated = this.animatedForSyncFrom('preview');
      scrollElementTo(editorScroller, desired, animated);
      this.releaseSourceAfterScroll(editorScroller, animated);
    });
  }

  private editorReference(): { line: number; progress: number } {
    const view = MarkEdit.editorView;
    const editorScroller = view.scrollDOM;
    const referenceHeight = editorScroller.scrollTop + this.editorReferenceOffset(editorScroller);
    const block = view.lineBlockAtHeight(referenceHeight);
    const line = view.state.doc.lineAt(block.from).number - 1;
    const progress = block.height > 0 ? clamp((referenceHeight - block.top) / block.height, 0, 1) : 0;
    return { line, progress };
  }

  private previewPositionForLine(line: number, progress: number): number | undefined {
    const exact = this.blockIndex.atLine(line);
    if (exact !== undefined) {
      const relative = relativeProgress(line, progress, exact.from, exact.to);
      return exact.top + exact.height * relative;
    }

    const { before, after } = this.blockIndex.enclosingLine(line);
    if (before !== undefined && after !== undefined && before !== after) {
      const beforeBottom = before.top + before.height;
      const gapLines = Math.max(1, after.from - before.to);
      const linesIntoGap = Math.max(0, line - before.to) + progress;
      const interpolation = clamp(linesIntoGap / gapLines, 0, 1);
      return beforeBottom + (after.top - beforeBottom) * interpolation;
    }

    if (before !== undefined) {
      return before.top + before.height;
    }

    return after?.top;
  }

  private previewReferenceLine(previewPane: HTMLElement): number | undefined {
    const y = previewPane.scrollTop + this.previewReferenceOffset(previewPane);
    const exact = this.blockIndex.atY(y);
    if (exact !== undefined) {
      return lineForY(exact, y);
    }

    const { before, after } = this.blockIndex.enclosingY(y);
    if (before !== undefined && after !== undefined && before !== after) {
      const beforeBottom = before.top + before.height;
      const gapHeight = Math.max(1, after.top - beforeBottom);
      const interpolation = clamp((y - beforeBottom) / gapHeight, 0, 1);
      return before.to + (after.from - before.to) * interpolation;
    }

    if (before !== undefined) {
      return before.to;
    }

    return after?.from;
  }

  private editorScrollTopForLine(lineFloat: number): number | undefined {
    const view = MarkEdit.editorView;
    const doc = view.state.doc;
    const lineNumber = clamp(Math.round(lineFloat) + 1, 1, doc.lines);
    const pos = doc.line(lineNumber).from;
    const block = view.lineBlockAt(pos);
    return clamp(block.top - this.editorReferenceOffset(view.scrollDOM), 0, maxScrollTop(view.scrollDOM));
  }

  private editorReferenceOffset(editorScroller: HTMLElement): number {
    return editorScroller.clientHeight * this.settings.referenceRatio;
  }

  private previewReferenceOffset(previewPane: HTMLElement): number {
    return previewPane.clientHeight * this.settings.referenceRatio;
  }

  private withSource(source: Exclude<SyncSource, 'none'>, action: () => void): void {
    this.source = source;
    action();
  }

  private beginIntegrationScroll(source: IntegrationScrollSource, options: IntegrationScrollOptions = {}): void {
    if (!this.started || !isIntegrationScrollSource(source)) {
      return;
    }

    this.clearSourceLock();
    this.source = source;
    if (options.animated !== undefined) {
      this.sourceAnimationOverride = {
        source,
        animated: options.animated,
      };
    }

    this.releaseSourceAfterDelay(source, options.animated ?? this.defaultAnimated());
  }

  private releaseSourceAfterDelay(source: IntegrationScrollSource, animated: boolean): void {
    this.releaseTimer = setTimeout(() => {
      if (this.source === source) {
        this.source = 'none';
        this.sourceAnimationOverride = undefined;
      }
      this.releaseTimer = undefined;
    }, animated ? SMOOTH_LOCK_RELEASE_MS : LOCK_RELEASE_MS);
  }

  private releaseSourceAfterScroll(element: HTMLElement, animated: boolean): void {
    if (this.releaseTimer !== undefined) {
      clearTimeout(this.releaseTimer);
    }
    if (this.releaseScrollEndDispose !== undefined) {
      this.releaseScrollEndDispose();
      this.releaseScrollEndDispose = undefined;
    }

    const release = () => {
      if (this.releaseTimer !== undefined) {
        clearTimeout(this.releaseTimer);
        this.releaseTimer = undefined;
      }
      if (this.releaseScrollEndDispose !== undefined) {
        this.releaseScrollEndDispose();
        this.releaseScrollEndDispose = undefined;
      }
      this.source = 'none';
      this.sourceAnimationOverride = undefined;
    };

    if (animated && 'onscrollend' in window) {
      element.addEventListener('scrollend', release, { once: true });
      this.releaseScrollEndDispose = () => element.removeEventListener('scrollend', release);
      this.releaseTimer = setTimeout(release, SMOOTH_LOCK_RELEASE_MS);
      return;
    }

    this.releaseTimer = setTimeout(() => {
      this.source = 'none';
      this.releaseTimer = undefined;
    }, animated ? SMOOTH_LOCK_RELEASE_MS : LOCK_RELEASE_MS);
  }

  private clearSourceLock(): void {
    if (this.releaseTimer !== undefined) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = undefined;
    }
    if (this.releaseScrollEndDispose !== undefined) {
      this.releaseScrollEndDispose();
      this.releaseScrollEndDispose = undefined;
    }
    this.source = 'none';
    this.sourceAnimationOverride = undefined;
  }

  private animatedForSyncFrom(source: IntegrationScrollSource): boolean {
    if (this.sourceAnimationOverride?.source === source) {
      return this.sourceAnimationOverride.animated;
    }
    return this.defaultAnimated();
  }

  private defaultAnimated(): boolean {
    return this.settings.syncTiming === 'afterScroll';
  }

  private publishIntegration(isActive: boolean): void {
    window.__markeditBidirectionalPreviewSync__ = {
      ...window.__markeditBidirectionalPreviewSync__,
      isActive,
      beginScroll: (source, options) => this.beginIntegrationScroll(source, options),
      beginPreviewScroll: (options) => this.beginIntegrationScroll('preview', options),
      beginEditorScroll: (options) => this.beginIntegrationScroll('editor', options),
    };
  }

  private findPreviewPane(): HTMLElement | undefined {
    const panes = Array.from(document.querySelectorAll<HTMLElement>(PREVIEW_SELECTOR));
    return panes.find(isDisplayed) ?? panes[0];
  }

  private async warnAboutNativeSync(): Promise<void> {
    const message =
      "To avoid conflicts, Bidirectional Preview Sync needs to disable MarkEdit-preview's one-way scroll sync feature.";

    console.warn(`[Bidirectional Preview Sync] ${message}`);
    if (this.nativeSyncAlertShown) {
      return;
    }
    this.nativeSyncAlertShown = true;
    await this.showNativeSyncAlert(message);
  }

  private async showNativeSyncAlert(message: string): Promise<void> {
    const action = await MarkEdit.showAlert({
      title: 'Disable Built-In Scroll Sync',
      message: `${message}\n\nQuit and reopen MarkEdit after disabling it for the change to take effect.`,
      buttons: ['Disable Scroll Sync', 'Not Now'],
    });

    if (action === 0) {
      await this.disableNativeSync();
    }
  }

  private async disableNativeSync(): Promise<void> {
    const parsed = await readSettings();
    if (parsed === undefined) {
      await MarkEdit.showAlert({
        title: "Couldn't Update settings.json",
        message:
          "Your settings.json couldn't be parsed as JSON, so it was left untouched.\n\n" +
          `Set "${PREVIEW_SETTINGS_NAMESPACE}.syncScroll" to false manually.`,
        buttons: ['OK'],
      });
      return;
    }

    parsed[PREVIEW_SETTINGS_NAMESPACE] = {
      ...settingsObject(parsed[PREVIEW_SETTINGS_NAMESPACE]),
      syncScroll: false,
    };

    if (!await writeSettings(parsed)) {
      await MarkEdit.showAlert({
        title: "Couldn't Update settings.json",
        message:
          'MarkEdit could not write settings.json. Check script permissions, or set ' +
          `"${PREVIEW_SETTINGS_NAMESPACE}.syncScroll" to false manually.`,
        buttons: ['OK'],
      });
      return;
    }

    await MarkEdit.showAlert({
      title: 'Relaunch MarkEdit to Finish Setup',
      message: 'Built-In Scroll Sync is now turned off.\n\nQuit and reopen MarkEdit so Bidirectional Preview Sync can take over scrolling.',
      buttons: ['OK'],
    });
  }
}

function lineForY(entry: BlockEntry, y: number): number {
  if (entry.to <= entry.from) {
    return entry.from;
  }

  const progress = clamp((y - entry.top) / entry.height, 0, 1);
  return entry.from + (entry.to - entry.from) * progress;
}

function relativeProgress(line: number, progress: number, from: number, to: number): number {
  const count = to - from;
  if (count < 1) {
    return line === from ? progress : 0;
  }

  return clamp(((line - from) + progress) / count, 0, 1);
}

function scrollElementTo(element: HTMLElement, top: number, animated: boolean): void {
  element.scrollTo({
    top,
    behavior: animated ? 'smooth' : 'instant',
  });
}

function maxScrollTop(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isDisplayed(element: HTMLElement): boolean {
  return getComputedStyle(element).display !== 'none' && element.offsetParent !== null;
}

function isIntegrationScrollSource(source: unknown): source is IntegrationScrollSource {
  return source === 'editor' || source === 'preview';
}
