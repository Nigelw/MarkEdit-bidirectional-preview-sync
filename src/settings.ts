import { MarkEdit } from 'markedit-api';
import type { JSONObject, JSONValue } from 'markedit-api';

export const SETTINGS_NAMESPACE = 'extension.bidirectionalScrollSync';
export const PREVIEW_SETTINGS_NAMESPACE = 'extension.markeditPreview';

export type Settings = {
  enabled: boolean;
  liveSync: boolean;
  referenceRatio: number;
  animated: boolean;
  showSetupWarning: boolean;
};

export function loadSettings(): Settings {
  const root = objectValue(MarkEdit.userSettings?.[SETTINGS_NAMESPACE]);

  return {
    enabled: booleanValue(root.enabled, true),
    liveSync: booleanValue(root.liveSync, false),
    referenceRatio: numberValue(root.referenceRatio, 0, 0, 1),
    animated: booleanValue(root.animated, false),
    showSetupWarning: booleanValue(root.showSetupWarning, true),
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

function booleanValue(value: JSONValue | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: JSONValue | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, value));
}
