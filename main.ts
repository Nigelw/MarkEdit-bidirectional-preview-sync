import { MarkEdit } from 'markedit-api';

import { installMenu } from './src/menu';
import { BidirectionalScrollSync } from './src/sync';

const controller = new BidirectionalScrollSync();

installMenu();

let started = false;
function start(): void {
  if (started) {
    return;
  }

  started = true;
  controller.start();
}

MarkEdit.onEditorReady(() => start());

// If the editor is already initialized when this script loads, start immediately
// because onEditorReady may not fire again for an already-ready editor.
try {
  if (MarkEdit.editorView !== undefined) {
    start();
  }
} catch {
  // editorView is not ready yet; onEditorReady will handle startup.
}
