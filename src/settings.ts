import { MarkEdit } from 'markedit-api';
import type { JSONObject, JSONValue } from 'markedit-api';

import { PREVIEW_SETTINGS_NAMESPACE, SETTINGS_NAMESPACE } from './constants';

export { PREVIEW_SETTINGS_NAMESPACE, SETTINGS_NAMESPACE };
export type SyncTiming = 'afterScroll' | 'whileScrolling';
export type UpdateBehavior = 'automatic' | 'notify' | 'never';

export type Settings = {
  syncTiming: SyncTiming;
  mirrorPreviewSelection: boolean;
  mirrorEditorSelection: boolean;
  referenceRatio: number;
  update: UpdateBehavior;
};

export function loadSettings(): Settings {
  const root = objectValue(MarkEdit.userSettings?.[SETTINGS_NAMESPACE]);
  const syncTiming = syncTimingValue(root.syncTiming, 'afterScroll');

  return {
    syncTiming,
    mirrorPreviewSelection: booleanValue(root.mirrorPreviewSelection, false),
    mirrorEditorSelection: booleanValue(root.mirrorEditorSelection, false),
    referenceRatio: numberValue(root.referenceRatio, 0, 0, 1),
    update: updateBehaviorValue(root.update, 'notify'),
  };
}

export function markEditPreviewSyncScrollDisabled(): boolean {
  const root = objectValue(MarkEdit.userSettings?.[PREVIEW_SETTINGS_NAMESPACE]);
  return root.syncScroll === false;
}

export function markEditPreviewSyncScrollStatus(): 'disabled' | 'enabled or unset' {
  return markEditPreviewSyncScrollDisabled() ? 'disabled' : 'enabled or unset';
}

export function settingsObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function objectValue(value: JSONValue | undefined): JSONObject {
  return settingsObject(value) as JSONObject;
}

function syncTimingValue(value: JSONValue | undefined, fallback: SyncTiming): SyncTiming {
  return value === 'afterScroll' || value === 'whileScrolling' ? value : fallback;
}

function updateBehaviorValue(value: JSONValue | undefined, fallback: UpdateBehavior): UpdateBehavior {
  return value === 'automatic' || value === 'notify' || value === 'never' ? value : fallback;
}

function booleanValue(value: JSONValue | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: JSONValue | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, value));
}
