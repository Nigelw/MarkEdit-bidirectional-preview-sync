import { EditorView } from '@codemirror/view';
import { MarkEdit } from 'markedit-api';

import { PreviewBlockIndex, type BlockEntry } from './previewBlocks';
import { loadSettings, markEditPreviewSyncScrollDisabled, PREVIEW_SETTINGS_NAMESPACE, settingsObject } from './settings';
import type { Settings } from './settings';
import { readSettings, writeSettings } from './settingsFile';

type SyncSource = 'editor' | 'preview' | 'none';
type Disposable = () => void;
type IntegrationState = {
  isActive?: boolean;
};

declare global {
  interface Window {
    __markeditBidirectionalScrollSync__?: IntegrationState;
  }
}

const PREVIEW_SELECTOR = '.markdown-body';
const LOCK_RELEASE_MS = 180;

export class BidirectionalScrollSync {
  private settings: Settings = loadSettings();
  private readonly blockIndex = new PreviewBlockIndex();
  private disposables: Disposable[] = [];
  private scrollDisposables: Disposable[] = [];
  private editorFrame: number | undefined;
  private previewFrame: number | undefined;
  private attachFrame: number | undefined;
  private attachedPreviewPane: HTMLElement | undefined;
  private waitingForPreviewLogged = false;
  private nativeSyncAlertShown = false;
  private source: SyncSource = 'none';
  private releaseTimer: ReturnType<typeof setTimeout> | undefined;
  private started = false;

  start(): void {
    this.stop();
    this.settings = loadSettings();

    if (!this.settings.enabled) {
      console.info('[Bidirectional Scroll Sync] Disabled by settings.');
      return;
    }

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

    if (this.editorFrame !== undefined) {
      cancelAnimationFrame(this.editorFrame);
      this.editorFrame = undefined;
    }
    if (this.previewFrame !== undefined) {
      cancelAnimationFrame(this.previewFrame);
      this.previewFrame = undefined;
    }
    if (this.attachFrame !== undefined) {
      cancelAnimationFrame(this.attachFrame);
      this.attachFrame = undefined;
    }
    if (this.releaseTimer !== undefined) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = undefined;
    }

    this.blockIndex.detach();
    this.attachedPreviewPane = undefined;
    this.waitingForPreviewLogged = false;
    this.nativeSyncAlertShown = false;
    this.source = 'none';
    this.started = false;
    setIntegrationActive(false);
  }

  showSetupStatus(): void {
    const previewPane = this.findPreviewPane();
    const nativeDisabled = markEditPreviewSyncScrollDisabled();

    void MarkEdit.showAlert({
      title: 'Bidirectional Scroll Sync',
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
        setIntegrationActive(false);
      }
      if (!this.waitingForPreviewLogged) {
        console.warn('[Bidirectional Scroll Sync] MarkEdit-preview pane not found; waiting for it to appear.');
        this.waitingForPreviewLogged = true;
      }
      return;
    }

    if (this.attachedPreviewPane === previewPane && this.started) {
      return;
    }

    this.detachScrollListeners();
    this.blockIndex.attach(previewPane);
    this.attachScrollListeners(MarkEdit.editorView.scrollDOM, previewPane);
    this.attachedPreviewPane = previewPane;
    this.waitingForPreviewLogged = false;
    this.started = true;
    setIntegrationActive(true);
    console.info('[Bidirectional Scroll Sync] Attached to MarkEdit-preview pane.');
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

  private addScrollListener(element: HTMLElement, handler: () => void): void {
    if (!this.settings.liveSync && 'onscrollend' in window) {
      element.addEventListener('scrollend', handler);
      this.scrollDisposables.push(() => element.removeEventListener('scrollend', handler));
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
      scrollElementTo(previewPane, desired, this.settings.animated);
      this.releaseSourceAfterScroll();
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
      scrollElementTo(editorScroller, desired, this.settings.animated);
      this.releaseSourceAfterScroll();
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

  private releaseSourceAfterScroll(): void {
    if (this.releaseTimer !== undefined) {
      clearTimeout(this.releaseTimer);
    }

    this.releaseTimer = setTimeout(() => {
      this.source = 'none';
      this.releaseTimer = undefined;
    }, LOCK_RELEASE_MS);
  }

  private findPreviewPane(): HTMLElement | undefined {
    const panes = Array.from(document.querySelectorAll<HTMLElement>(PREVIEW_SELECTOR));
    return panes.find(isDisplayed) ?? panes[0];
  }

  private async warnAboutNativeSync(): Promise<void> {
    const message =
      'Bidirectional Scroll Sync needs MarkEdit-preview native scroll sync disabled. ' +
      'Otherwise both extensions will compete and cause correction jumps.';

    console.warn(`[Bidirectional Scroll Sync] ${message}`);
    if (!this.settings.showSetupWarning || this.nativeSyncAlertShown) {
      return;
    }
    this.nativeSyncAlertShown = true;
    await this.showNativeSyncAlert(message);
  }

  private async showNativeSyncAlert(message: string): Promise<void> {
    const action = await MarkEdit.showAlert({
      title: 'Disable MarkEdit-preview Sync Scroll',
      message: `${message}\n\nThe extension can update settings.json for you. Quit and reopen MarkEdit afterward so MarkEdit-preview reloads with sync disabled.`,
      buttons: ['Disable Sync Scroll', 'Not Now'],
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
      title: 'Restart Required',
      message: 'MarkEdit-preview syncScroll has been disabled. Quit and reopen MarkEdit so the change takes effect in every open document.',
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

function setIntegrationActive(isActive: boolean): void {
  window.__markeditBidirectionalScrollSync__ = {
    ...window.__markeditBidirectionalScrollSync__,
    isActive,
  };
}
