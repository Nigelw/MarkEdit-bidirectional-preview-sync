import { MarkEdit } from 'markedit-api';

const SETTINGS_FILE = 'settings.json';

export function settingsPath(): string {
  return `${MarkEdit.getDirectoryPath('documents')}/${SETTINGS_FILE}`;
}

export async function readSettings(): Promise<Record<string, unknown> | undefined> {
  const content = await MarkEdit.getFileContent(settingsPath());
  if (content === undefined || content.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export async function writeSettings(settings: Record<string, unknown>): Promise<boolean> {
  return MarkEdit.createFile({
    path: settingsPath(),
    string: `${JSON.stringify(settings, null, 2)}\n`,
    overwrites: true,
  });
}
