import { MarkEdit } from 'markedit-api';
import type { MenuItem } from 'markedit-api';

import { EXTENSION_NAME, REPO_URL } from './constants';
import { loadSettings, SETTINGS_NAMESPACE, settingsObject } from './settings';
import type { SyncTiming } from './settings';
import type { BidirectionalScrollSync } from './sync';
import { readSettings, writeSettings } from './settingsFile';
import { checkForUpdates } from './updater';

export function installMenu(controller: BidirectionalScrollSync): void {
  MarkEdit.addMainMenuItem({
    title: EXTENSION_NAME,
    children: [
      {
        title: 'Sync After Scroll',
        action: () => void setSyncTiming('afterScroll', controller),
        state: () => ({ isSelected: controller.syncTiming() === 'afterScroll' }),
      },
      {
        title: 'Sync During Scroll',
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
      {
        title: 'Visit GitHub Project',
        action: () => openURL(REPO_URL),
      },
      {
        title: 'Check for Updates...',
        action: () => void checkForUpdates(loadSettings().update, true),
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

function openURL(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
