import { MarkEdit } from 'markedit-api';
import type { MenuItem } from 'markedit-api';

import { markEditPreviewSyncScrollStatus } from './settings';

export function installMenu(): void {
  MarkEdit.addMainMenuItem({
    title: 'Bidirectional Scroll Sync',
    children: [
      {
        title: 'Check Setup',
        action: () => {
          // The controller is not needed for this static setup guidance.
          void MarkEdit.showAlert({
            title: 'Bidirectional Scroll Sync',
            message: [
              `MarkEdit-preview syncScroll: ${markEditPreviewSyncScrollStatus()}.`,
              '',
              'This extension runs automatically when MarkEdit-preview syncScroll is disabled.',
              'Quit and reopen MarkEdit after changing this extension or MarkEdit-preview settings.',
            ].join('\n'),
            buttons: ['OK'],
          });
        },
      },
      {
        title: 'About',
        action: () => {
          void MarkEdit.showAlert({
            title: 'Bidirectional Scroll Sync',
            message:
              'Best-effort editor-to-preview and preview-to-editor scroll sync. ' +
              'Disable MarkEdit-preview syncScroll so this extension can own both directions.',
            buttons: ['OK'],
          });
        },
      },
    ],
  } satisfies MenuItem);
}
