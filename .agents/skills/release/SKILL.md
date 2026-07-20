---
name: release
description: Cut a new release of the MarkEdit Bidirectional Preview Sync extension: bump the version, update the changelog, build, tag, push, and publish a GitHub release with the compiled bundle attached as an asset. Use when the user says "release", "cut a release", "ship a new version", "publish v1.2.0", or wants to make the in-app auto-updater offer a new build.
---

# Release MarkEdit Bidirectional Preview Sync

This extension has an in-app self-updater (`src/updater.ts`). Installed copies poll
`api.github.com/repos/Nigelw/MarkEdit-bidirectional-preview-sync/releases/latest`, compare the
release tag against their baked-in version, and, when a newer one exists, download the release's
`markedit-bidirectional-preview-sync.js` asset via its `browser_download_url` and overwrite their
own script file with it.

A release is only usable by the updater if all of these agree:

1. `package.json` `version` = the new version, baked into the bundle at build time.
2. `dist/markedit-bidirectional-preview-sync.js` is freshly rebuilt from that version.
3. The GitHub release for `v<version>` has a `markedit-bidirectional-preview-sync.js` asset that is
   exactly that freshly-built bundle.

## Before Starting

- Confirm the working tree is clean with `git status` and that you are on `main`. If there are
  unrelated uncommitted changes, stop and ask the user how to proceed.
- Determine the new version. If the user did not specify one, ask whether it is a patch, minor, or
  major bump and compute it from the current `package.json` `version`. Use plain semver
  (`MAJOR.MINOR.PATCH`); the git tag is that with a `v` prefix (`v1.2.0`).

## Steps

1. Bump the version in `package.json` to the new version without a `v` prefix. Edit the file
   directly; do not run `npm version`, because it also creates a tag.

2. Update `CHANGELOG.md`. This is interactive:
   - Gather commits since the previous release with `git describe --tags --abbrev=0`, then
     `git log <prev-tag>..HEAD --pretty=format:'%s%n%b%x1e'`. If there is no previous tag, use the
     whole history.
   - Draft user-facing entries grouped under `### New`, `### Improved`, and `### Fixed`, including
     anything already under `## Unreleased`. Skip release/version bumps, pure docs, CI, chore, merge
     commits, and anything with no user-visible effect.
   - Present the draft and ask the user to edit and confirm it. Do not write the final changelog
     section until the user approves.
   - Replace the `## Unreleased` section with a fresh empty `## Unreleased` plus
     `## <version> (<YYYY-MM-DD>)` containing the approved notes.

3. Typecheck with `npm run typecheck`. Fix or report errors before continuing.

4. Build with `npm run build`. This bakes the package version into the bundle, writes
   `dist/markedit-bidirectional-preview-sync.js`, and deploys a copy into the local MarkEdit scripts
   folder.

5. Verify the bundle carries the new version:
   `grep -c "<new-version>" dist/markedit-bidirectional-preview-sync.js` should be at least 1.
   If it is 0, stop and investigate.

6. Commit the release files:
   `git add package.json CHANGELOG.md` and commit as `Release v<version>`. Include any intended
   source/doc changes for this release before tagging.

7. Tag the release commit: `git tag -a v<version> -m "v<version>"`.

8. Push the branch and tag: `git push origin main` and `git push origin v<version>`.

9. Publish the GitHub release with the updater asset attached:
   `gh release create v<version> --title "v<version>" --notes "<changelog section>" dist/markedit-bidirectional-preview-sync.js`
   The uploaded asset name must remain `markedit-bidirectional-preview-sync.js`.

10. Verify the latest release exposes the exact asset:
    ```sh
    url=$(curl -sS "https://api.github.com/repos/Nigelw/MarkEdit-bidirectional-preview-sync/releases/latest" \
      | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d).assets||[];const m=a.find(x=>x.name==='markedit-bidirectional-preview-sync.js');console.log(m?m.browser_download_url:'MISSING')})")
    echo "asset url: $url"
    [ "$url" = MISSING ] || curl -sSfI "$url" | head -1
    ```
    Expect a real URL and `HTTP/2 200`.

## Report Back

Tell the user the released version, the release URL, and the result of the asset check so they know
the auto-updater will serve it.

## Notes

- The repo must stay public for unauthenticated GitHub API and release-asset fetches.
- Never tag or upload without rebuilding. The uploaded asset must match `package.json`'s version.
