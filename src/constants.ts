/** Extension display name used in menus and updater alerts. */
export const EXTENSION_NAME = 'Bidirectional Preview Sync';

/**
 * settings.json key holding this extension's settings. The `extension.` prefix
 * is required by MarkEdit's settings schema.
 */
export const SETTINGS_NAMESPACE = 'extension.bidirectionalPreviewSync';

/** settings.json key used by MarkEdit-preview. */
export const PREVIEW_SETTINGS_NAMESPACE = 'extension.markeditPreview';

/**
 * GitHub repo hosting this extension's releases, in `owner/repo` form. Used to
 * build the update-check URL below.
 */
export const GITHUB_REPO = 'Nigelw/MarkEdit-bidirectional-preview-sync';

/** Human-facing GitHub project page, linked from the Extensions menu. */
export const REPO_URL = `https://github.com/${GITHUB_REPO}`;

/** Human-facing release notes document, linked from the Extensions menu. */
export const RELEASE_NOTES_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;

/** GitHub API endpoint returning the metadata of the latest published release. */
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/**
 * Name of the release asset the updater downloads and installs: the built
 * script, matching `package.json`'s `name` + `.js`.
 */
export const UPDATE_ASSET_NAME = 'markedit-bidirectional-preview-sync.js';

/** localStorage key holding the epoch-ms timestamp of the last update check. */
export const LAST_CHECK_STORAGE_KEY = 'markedit-bidirectional-preview-sync.updater.last-check';

/** localStorage key holding a JSON array of release tags the user chose to skip. */
export const SKIPPED_VERSIONS_STORAGE_KEY = 'markedit-bidirectional-preview-sync.updater.skipped';
