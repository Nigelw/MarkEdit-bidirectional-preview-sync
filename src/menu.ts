import { MarkEdit } from 'markedit-api';
import type { MenuItem } from 'markedit-api';

import type { BidirectionalScrollSync } from './sync';

export function installMenu(controller: BidirectionalScrollSync): void {
  MarkEdit.addMainMenuItem({
    title: 'Bidirectional Scroll Sync',
    children: [
      {
        title: 'Restart Sync',
        action: () => controller.restart(),
      },
      {
        title: 'Check Setup',
        action: () => controller.showSetupStatus(),
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
