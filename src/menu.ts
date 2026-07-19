import { MarkEdit } from 'markedit-api';
import type { MenuItem } from 'markedit-api';

import { loadSettings, markEditPreviewSyncScrollStatus, SETTINGS_NAMESPACE, settingsObject } from './settings';
import type { SyncTiming } from './settings';
import type { BidirectionalScrollSync } from './sync';
import { readSettings, writeSettings } from './settingsFile';

export function installMenu(controller: BidirectionalScrollSync): void {
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
              'Quit and reopen MarkEdit after changing MarkEdit-preview syncScroll.',
            ].join('\n'),
            buttons: ['OK'],
          });
        },
      },
      { separator: true },
      {
        title: 'Sync After Scrolling Stops',
        action: () => void setSyncTiming('afterScroll', controller),
        state: () => ({ isSelected: controller.syncTiming() === 'afterScroll' }),
      },
      {
        title: 'Sync While Scrolling',
        action: () => void setSyncTiming('whileScrolling', controller),
        state: () => ({ isSelected: controller.syncTiming() === 'whileScrolling' }),
      },
      { separator: true },
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

async function setSyncTiming(timing: SyncTiming, controller: BidirectionalScrollSync): Promise<void> {
  const parsed = await readSettings();
  if (parsed === undefined) {
    await MarkEdit.showAlert({
      title: "Couldn't update settings.json",
      message:
        "Your settings.json couldn't be parsed as JSON, so it was left untouched.\n\n" +
        `Set "syncTiming": "${timing}" under "${SETTINGS_NAMESPACE}" manually.`,
      buttons: ['OK'],
    });
    return;
  }

  parsed[SETTINGS_NAMESPACE] = {
    ...settingsObject(parsed[SETTINGS_NAMESPACE]),
    syncTiming: timing,
  };

  const ok = await writeSettings(parsed);
  if (!ok) {
    await MarkEdit.showAlert({
      title: 'Failed to write settings.json',
      message:
        'Could not write settings.json. Check permissions in the MarkEdit Documents folder, ' +
        `or set "syncTiming": "${timing}" under "${SETTINGS_NAMESPACE}" manually.`,
      buttons: ['OK'],
    });
    return;
  }

  await reloadMarkEditSettings(parsed);
  controller.reloadSettings();
}

async function reloadMarkEditSettings(parsed: Record<string, unknown>): Promise<void> {
  const api = MarkEdit as typeof MarkEdit & { loadSettings?: () => void | Promise<void> };
  await api.loadSettings?.();
  (MarkEdit.userSettings as Record<string, unknown>)[SETTINGS_NAMESPACE] = parsed[SETTINGS_NAMESPACE];

  const settings = loadSettings();
  (MarkEdit.userSettings as Record<string, unknown>)[SETTINGS_NAMESPACE] = {
    ...settingsObject(MarkEdit.userSettings?.[SETTINGS_NAMESPACE]),
    syncTiming: settings.syncTiming,
  };
}
