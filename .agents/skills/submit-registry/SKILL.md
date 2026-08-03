---
name: submit-registry
description: Submit the latest MarkEdit extension release to the official MarkEdit-app/extensions registry, including immutable release URL and SHA-256 verification, registry validation, and a mandatory user review gate for the exact registry JSON and draft PR body. Use when Codex is asked to register this extension, update its registry entry, or open a registry draft PR.
---

# Submit Latest Release to the MarkEdit Registry

Use this skill only for the registry submission workflow. The project release must already exist; use
the release skill at ../release/SKILL.md first when the latest release has not been published.

## Non-negotiable rules

- Use the latest published release, not main, a mutable latest URL, or an untagged build.
- The registry URL must be the exact JavaScript file committed at the immutable release tag:
  https://raw.githubusercontent.com/<owner>/<repo>/v<version>/dist/<package-name>.js
- Verify the URL is reachable and compute the SHA-256 from the exact bytes at that URL.
- Never hand-edit index.json or site/; the registry workflow generates them.
- Do not open, submit, mark ready, or merge a pull request until the user has explicitly reviewed and
  approved both the complete registry JSON and the exact PR body.
- Never silently change the approved JSON or PR body after approval. If a URL, hash, version, or other
  content changes, show the revised draft and request approval again.

## Workflow

### 1. Resolve the release and registry context

1. Confirm the extension repository and working-tree state with git remote -v and git status -sb.
   Stop if unrelated local changes make the release context ambiguous.
2. Read package.json for the package name and current version, and derive the GitHub owner/repository
   from origin.
3. Inspect the latest published GitHub release through the GitHub connector, gh, or the signed-in
   browser. Confirm its tag is a semantic version and that it contains the expected
   markedit-bidirectional-preview-sync.js asset.
4. Confirm the matching tag contains the committed dist/<package-name>.js. If it does not, stop and
   direct the user to run the release skill; do not substitute a mutable release-download URL without
   explicit maintainer approval.

### 2. Verify the immutable bundle

Construct the raw URL from the release tag and verify it directly:

~~~sh
curl -fsSL -o file "<raw-tagged-url>"
shasum -a 256 file
~~~

Use the resulting 64-character hash in the registry entry. Keep the downloaded file in a temporary
location and compare its hash with the local release bundle when available.

### 3. Prepare the registry entry

Use the registry repository's current schema and conventions. The normal extension entry belongs at:

~~~text
extensions/<id>.json
~~~

Required fields are $schema, id, name, description, author, homepage, and versions.

- Make id kebab-case and exactly equal to the JSON filename without .json.
- Put the newest version first in versions; preserve existing verified history when updating an entry.
- Include version, url, and sha256 for every listed build.
- Add notes only when a concise release note is available. Do not invent minAppVersion.
- Omit index.json and generated gallery output from the proposed change.

For a first submission, use this shape:

~~~json
{
  "$schema": "https://github.com/MarkEdit-app/extensions/raw/refs/heads/main/schemas/extension.schema.json",
  "id": "<id>",
  "name": "<display name>",
  "description": "<one-line description>",
  "author": "<author>",
  "homepage": "<https homepage>",
  "versions": [
    {
      "version": "<version>",
      "url": "<raw tagged bundle URL>",
      "sha256": "<64-character SHA-256 hash>"
    }
  ]
}
~~~

### 4. Validate before submission

Prepare a temporary checkout of the registry fork or upstream repository, add the candidate JSON there,
and run the registry build without committing generated output:

~~~sh
yarn install --frozen-lockfile
yarn build
~~~

The build must pass schema validation, filename/ID validation, URL reachability, and hash integrity.
If Yarn is unavailable, use an equivalent temporary dependency install only for validation and report
that fallback.

Check for an existing open PR for the same extension/version before proceeding. Avoid duplicate entries
or duplicate submissions.

### 5. Mandatory review checkpoint

Before creating a remote registry branch or opening the PR, show the user:

1. The complete proposed JSON file.
2. The proposed PR title.
3. The exact PR body that will be submitted.

State that the release URL and SHA-256 have been verified. Stop and wait for explicit approval. Treat
"approved" or an equivalent confirmation as authorization to continue; treat edits as a request to
revise and show the complete drafts again.

Use the user's approved PR body verbatim. Do not add automatic summaries, validation sections, or
boilerplate unless the user approves the revised body.

### 6. Create the branch, commit, and draft PR after approval

1. Use the user's fork of MarkEdit-app/extensions, normally Nigelw/extensions. Confirm the fork's
   default branch and permissions through the GitHub connector.
2. Create a unique branch such as agent/add-<id>-v<version> from the fork's default branch.
3. Add or update only extensions/<id>.json, commit with a terse message such as
   Add <display name> to registry, and push the branch.
4. Open a draft PR targeting MarkEdit-app/extensions:main. Set the head to the fork branch, preserve
   maintainer edits unless the user says otherwise, and use the approved title/body exactly.
5. If the connector cannot create a cross-fork PR, use the signed-in browser's compare-across-forks
   flow. Select the draft PR type, verify the base and head repositories, then submit.
6. Verify the resulting PR is marked Draft, targets MarkEdit-app/extensions:main, contains exactly
   the intended JSON change, and shows the approved body.

Do not mark the PR ready for review, merge it, or modify the registry's generated files.

## Report

Report the registry entry path, fork branch, commit, validation result, and draft PR URL. Mention any
fallback used for authentication, browser submission, or dependency installation.
