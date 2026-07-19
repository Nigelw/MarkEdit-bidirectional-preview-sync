import { MarkEdit } from 'markedit-api';

import {
  EXTENSION_NAME,
  LAST_CHECK_STORAGE_KEY,
  LATEST_RELEASE_URL,
  SKIPPED_VERSIONS_STORAGE_KEY,
  UPDATE_ASSET_NAME,
} from './constants';
import type { UpdateBehavior } from './settings';

const CURRENT_VERSION = __EXTENSION_VERSION__;
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface Release {
  tag_name: string;
  assets?: ReleaseAsset[];
}

function parseVersion(value: string): number[] | undefined {
  const match = value.trim().match(/^v?(\d+(?:\.\d+)*)/);
  if (match === null) {
    return undefined;
  }
  return match[1].split('.').map((part) => parseInt(part, 10));
}

function isNewer(remote: string, current: string): boolean {
  const a = parseVersion(remote);
  const b = parseVersion(current);
  if (a === undefined || b === undefined) {
    return remote !== current;
  }

  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) {
      return diff > 0;
    }
  }
  return false;
}

function skippedVersions(): Set<string> {
  try {
    const raw = localStorage.getItem(SKIPPED_VERSIONS_STORAGE_KEY);
    const parsed = JSON.parse(raw ?? '[]') as unknown;
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function skipVersion(tag: string): void {
  const set = skippedVersions();
  set.add(tag);
  localStorage.setItem(SKIPPED_VERSIONS_STORAGE_KEY, JSON.stringify([...set]));
}

async function fetchLatestRelease(): Promise<Release | undefined> {
  const response = await fetch(LATEST_RELEASE_URL);
  if (!response.ok) {
    return undefined;
  }

  const json = (await response.json()) as Partial<Release>;
  return typeof json.tag_name === 'string' ? (json as Release) : undefined;
}

async function downloadAndInstall(release: Release): Promise<boolean> {
  const path = __FILE_PATH__;
  if (typeof path !== 'string') {
    console.error(`${EXTENSION_NAME} updater: unknown script path, cannot install.`);
    return false;
  }

  const asset = release.assets?.find((a) => a.name === UPDATE_ASSET_NAME);
  if (asset === undefined) {
    console.error(`${EXTENSION_NAME} updater: release ${release.tag_name} has no ${UPDATE_ASSET_NAME} asset.`);
    return false;
  }

  try {
    const response = await fetch(asset.browser_download_url);
    if (!response.ok) {
      console.error(`${EXTENSION_NAME} updater: failed to download ${asset.browser_download_url} (${response.status}).`);
      return false;
    }

    const code = await response.text();
    return MarkEdit.createFile({ path, string: code, overwrites: true });
  } catch (error) {
    console.error(`${EXTENSION_NAME} updater: download failed:`, error);
    return false;
  }
}

async function installAndReport(release: Release): Promise<void> {
  const ok = await downloadAndInstall(release);
  await MarkEdit.showAlert(
    ok
      ? {
          title: `Updated to ${release.tag_name}`,
          message: `Restart MarkEdit to start using the new version of ${EXTENSION_NAME}.`,
          buttons: ['OK'],
        }
      : {
          title: 'Update failed',
          message:
            `The ${EXTENSION_NAME} extension couldn't download the latest build. Check your connection and ` +
            `try again from Extensions -> ${EXTENSION_NAME} -> Check for Updates....`,
          buttons: ['OK'],
        },
  );
}

async function promptForUpdate(release: Release): Promise<void> {
  const choice = await MarkEdit.showAlert({
    title: `${EXTENSION_NAME} ${release.tag_name} is available`,
    message: `You have ${CURRENT_VERSION}. Update now?`,
    buttons: ['Update Now', 'Skip This Version', 'Later'],
  });

  if (choice === 0) {
    await installAndReport(release);
  } else if (choice === 1) {
    skipVersion(release.tag_name);
  }
}

export async function checkForUpdates(behavior: UpdateBehavior, manual = false): Promise<void> {
  if (behavior === 'never' && !manual) {
    return;
  }

  if (!manual) {
    const last = Number(localStorage.getItem(LAST_CHECK_STORAGE_KEY) ?? '0');
    if (Date.now() - last < CHECK_INTERVAL_MS) {
      return;
    }
    localStorage.setItem(LAST_CHECK_STORAGE_KEY, String(Date.now()));
  }

  let release: Release | undefined;
  try {
    release = await fetchLatestRelease();
  } catch (error) {
    console.error(`${EXTENSION_NAME} updater: failed to check for updates:`, error);
    if (manual) {
      await MarkEdit.showAlert({
        title: 'Update check failed',
        message: "Couldn't reach GitHub to check for updates. Please try again later.",
        buttons: ['OK'],
      });
    }
    return;
  }

  if (release === undefined || !isNewer(release.tag_name, CURRENT_VERSION)) {
    if (manual) {
      await MarkEdit.showAlert({
        title: "You're up to date",
        message: `${EXTENSION_NAME} ${CURRENT_VERSION} is the latest version.`,
        buttons: ['OK'],
      });
    }
    return;
  }

  if (!manual && skippedVersions().has(release.tag_name)) {
    return;
  }

  if (behavior === 'automatic' && !manual) {
    await installAndReport(release);
  } else {
    await promptForUpdate(release);
  }
}
