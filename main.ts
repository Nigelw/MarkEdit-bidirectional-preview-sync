import { MarkEdit } from 'markedit-api';
import type { EditorView } from '@codemirror/view';

import { installMenu } from './src/menu';
import { BidirectionalPreviewSync } from './src/sync';

const controller = new BidirectionalPreviewSync();

installMenu(controller);

let readyEditor: EditorView | undefined;
function start(editor: EditorView): void {
  if (readyEditor === editor) {
    return;
  }
  readyEditor = editor;

  // MarkEdit replaces the EditorView when a document is reloaded. Restarting
  // tears down listeners bound to the old scroll element and attaches them to
  // the replacement view while preserving the existing preview-sync behavior.
  controller.start();
}

MarkEdit.onEditorReady((editor) => start(editor));

// If the editor is already initialized when this script loads, start immediately
// because onEditorReady may not fire again for an already-ready editor.
try {
  if (MarkEdit.editorView !== undefined) {
    start(MarkEdit.editorView);
  }
} catch {
  // editorView is not ready yet; onEditorReady will handle startup.
}
