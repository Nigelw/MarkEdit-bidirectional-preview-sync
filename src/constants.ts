/** Extension display name used in menus and alerts. */
export const EXTENSION_NAME = 'Bidirectional Preview Sync';

/**
 * settings.json key holding this extension's settings. The `extension.` prefix
 * is required by MarkEdit's settings schema.
 */
export const SETTINGS_NAMESPACE = 'extension.bidirectionalPreviewSync';

/** settings.json key used by MarkEdit-preview. */
export const PREVIEW_SETTINGS_NAMESPACE = 'extension.markeditPreview';

/**
 * GitHub repo hosting this extension, in `owner/repo` form.
 */
export const GITHUB_REPO = 'Nigelw/MarkEdit-bidirectional-preview-sync';

/** Human-facing GitHub project page, linked from the Extensions menu. */
export const REPO_URL = `https://github.com/${GITHUB_REPO}`;

/** Human-facing release notes document, linked from the Extensions menu. */
export const RELEASE_NOTES_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;
