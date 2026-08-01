---
name: release
description: Cut a new release of the MarkEdit Bidirectional Preview Sync extension: bump the version, update the changelog, build, tag, push, and publish a GitHub release with the compiled bundle attached as an asset. Use when the user says "release", "cut a release", "ship a new version", or "publish v1.2.0".
---

# Release MarkEdit Bidirectional Preview Sync

Each release should keep these artifacts aligned for manual installation and registry distribution:

1. `package.json` `version` = the new version.
2. `dist/markedit-bidirectional-preview-sync.js` is freshly rebuilt from that version.
3. The GitHub release for `v<version>` has a `markedit-bidirectional-preview-sync.js` asset that is
   exactly that freshly-built bundle.

Updates for registry-installed copies are managed centrally by MarkEdit's Extension Manager.

## Before Starting

- Confirm the working tree is clean with `git status` and that you are on `main`. If there are
  unrelated uncommitted changes, stop and ask the user how to proceed.
- Determine the new version. If the user did not specify one, ask whether it is a patch, minor, or
  major bump and compute it from the current `package.json` `version`. Use plain semver
  (`MAJOR.MINOR.PATCH`); the git tag is that with a `v` prefix (`v1.2.0`).

## Steps

1. Bump the version in `package.json` to the new version without a `v` prefix. Edit the file
   directly; do not run `npm version`, because it also creates a tag.

2. Draft user-facing release notes. This is interactive:
   - Gather commits since the previous release with `git describe --tags --abbrev=0`, then
     `git log --no-merges <prev-tag>..HEAD --pretty='%s%n%b'`. If there is no previous tag, use the
     whole history.
   - Add a new `CHANGELOG.md` section for the chosen version directly below `# Changelog`:
     ```markdown
     ## <version> (YYYY-MM-DD)

     ### New

     - ...
     ```
   - Draft the section from the commits. Author it as short user-facing Markdown, applying these
     rules:
     - Draft release note entries under three Markdown `###` headings in this order: `New` for
       major, headline features; `Improved` for quality-of-life updates and polish; `Fixed` for bug
       fixes. Omit a bucket if it has no entries.
     - Rewrite every entry from the user's perspective. Describe what changed for someone using the
       extension.
     - Drop anything with no user-visible impact: internal refactors, tests, CI changes, dependency
       bumps, and doc edits.
     - Use one succinct line per entry, with no jargon, file names, symbols, or implementation
       details.
   - Let the user review and edit before continuing. Show the new `CHANGELOG.md` section, offer to
     open the file with `${EDITOR:-${VISUAL:-open}} CHANGELOG.md`, or take edits in conversation.
     Get explicit confirmation before continuing.
   - The GitHub release body must use the approved changelog section.

3. Typecheck with `npm run typecheck`. Fix or report errors before continuing.

4. Build with `npm run build`. This writes `dist/markedit-bidirectional-preview-sync.js` and deploys
   a copy into the local MarkEdit scripts folder.

5. Verify the bundle was produced:
   `test -s dist/markedit-bidirectional-preview-sync.js`

6. Commit the release files:
   `git add package.json CHANGELOG.md dist/markedit-bidirectional-preview-sync.js` and commit as
   `Release v<version>`. Include any intended source/doc changes for this release before tagging.

7. Tag the release commit: `git tag -a v<version> -m "v<version>"`.

8. Push the branch and tag: `git push origin main` and `git push origin v<version>`.

9. Publish the GitHub release with the compiled asset attached:
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

Tell the user the released version, the release URL, and the result of the asset check so they can
install it manually or use it for registry distribution.

## Notes

- The repo must stay public for unauthenticated release-asset and registry fetches.
- Never tag or upload without rebuilding. The uploaded asset must match `package.json`'s version.
