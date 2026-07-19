import { MarkEdit } from 'markedit-api';

import { installMenu } from './src/menu';
import { loadSettings } from './src/settings';
import { BidirectionalPreviewSync } from './src/sync';
import { checkForUpdates } from './src/updater';

const controller = new BidirectionalPreviewSync();

installMenu(controller);

MarkEdit.onAppReady(() => {
  setTimeout(() => void checkForUpdates(loadSettings().update), 2000);
});

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
