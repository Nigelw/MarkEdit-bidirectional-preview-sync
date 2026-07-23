# Preview Selection Mirroring QA Results

QA date: July 21, 2026

Test document: `selection-mirroring-test.md`

Scope: preview-to-editor selection mirroring only. This report documents MarkEdit UI checks plus source-offset review without changing extension code. Statuses use `Pass` when the editor selection matches the rendered preview selection and excludes hidden Markdown syntax, `Fail` when it does not, and `Expected limitation` when the result is acceptable under the stated best-effort behavior for complex rendered content.

Methodology correction: an earlier pass treated the normalized Markdown text stream as the final selected editor content. That missed cases where selection endpoints at rendered formatting boundaries map to source ranges containing hidden Markdown syntax. Retesting in MarkEdit and user verification showed the editor selection can visibly include both opening and closing Markdown markers when selecting simple rendered formatting. Those rows are now marked as failures.

## 1. Stabilize Baseline Text And Whitespace Selection

Focus on exact character boundaries before adding syntax-aware behavior. Preserve selected whitespace within plain prose and before styled spans, and distinguish visible selected whitespace from invisible paragraph-edge whitespace.

| ID | Name | Description | Status |
| --- | --- | --- | --- |
| SM-001 | Baseline prose, forward letter drag | Select `plain Markdown text` left-to-right by character drag in the Baseline Prose paragraph. | Pass |
| SM-002 | Baseline prose, backward letter drag | Select the same phrase right-to-left by character drag. | Pass |
| SM-003 | Baseline prose, word drag | Double-click-drag across `plain Markdown text`. | Pass |
| SM-004 | Baseline prose, paragraph drag | Triple-click-drag the Baseline Prose paragraph. | Pass |
| SM-005 | Baseline prose, internal leading space | Select the space before `Markdown` plus `Markdown`. | Pass |
| SM-006 | Baseline prose, internal trailing space | Select `Markdown` plus the following space. | Pass |
| SM-007 | Baseline prose, paragraph-edge whitespace | Try to include invisible paragraph-edge whitespace before the first word or after the final period. | Pass: rendered offsets now map directly to source characters instead of a collapsed stream, so selected whitespace is preserved. When the paragraph has no source-side edge whitespace (as here) the selection maps to the exact full visible line rather than being pushed inward. |
| SM-008 | Leading whitespace before styled text | Select the rendered space immediately before styled text plus the start of the styled span, such as the space before `bold text` or `italic text`. | Pass: the leading space is now mapped to its source position, so the mirrored editor selection starts at the whitespace before the span. (Excluding the span's opening/closing markers is tracked separately under section 3.) |
| SM-009 | Baseline prose, across words | Select from the middle of `plain` through the middle of `text`. | Pass |
| SM-064 | Plain click clears a mirrored selection | With a mirrored selection in place (preview and editor both showing the same text), single-click inside the preview selection so the preview selection clears. | Pass (previously failed): a plain click in non-editable preview content clears the native selection to nothing (no anchor node), which previously skipped the collapse path and left the editor's mirrored range selected. A settle from a preview pointer gesture now collapses the editor selection to the start of the previously mirrored source range even when no anchor node remains. Verified live. Editor typing (a document-wide keyup with the selection anchored in the editor) still leaves the editor cursor untouched. |

## 2. Keep Heading Selection Reliable

Maintain the current basic heading behavior while avoiding regressions around generated heading anchors. Headings are structurally simple but commonly used, so they should stay reliable before deeper inline formatting work.

| ID | Name | Description | Status |
| --- | --- | --- | --- |
| SM-010 | Heading visible text | Select `Repeated Heading` in the first repeated heading. | Pass |
| SM-011 | Heading backward selection | Select `Repeated Heading` right-to-left. | Pass |
| SM-012 | Heading syntax exclusion | Confirm the mirrored editor selection excludes `### `. | Pass |
| SM-013 | Generated heading anchor | Select from a generated heading anchor/link affordance, if shown, into the heading text. | Expected limitation: anchor DOM may map to the nearest heading source span, not exact visible characters. |

## 3. Fix Simple Inline Formatting Wrappers

Ensure selecting rendered bold, italic, bold italic, strikethrough, and inline code maps to the rendered content only, excluding both opening and closing Markdown syntax. Also handle selections that include adjacent rendered punctuation or cross between adjacent formatted spans.

| ID | Name | Description | Status |
| --- | --- | --- | --- |
| SM-014 | Bold text exact | Select rendered `bold text`. | Pass: span-boundary markers are now stripped, so the mirrored editor selection is exactly `bold text` with both `**` wrappers excluded. |
| SM-015 | Bold text partial word | Select only `old tex` inside rendered bold text. | Pass |
| SM-016 | Bold text with adjacent comma | Select `bold text,` including the rendered comma after the bold span. | Expected limitation: the opening `**` is now excluded, but because the comma follows the closing `**` in source, a single contiguous editor selection cannot skip those interior markers; the mirror is `bold text**,`. Selecting only `bold text` (SM-014) is clean. |
| SM-017 | Bold syntax exclusion | Confirm selecting rendered bold text mirrors `bold text`, not `**bold text**`. | Pass: selecting rendered bold text now mirrors `bold text`; both opening and closing `**` are excluded. |
| SM-018 | Italic text exact | Select rendered `italic text`. | Pass: the `_` wrappers are excluded, so the mirror is exactly `italic text`. |
| SM-019 | Italic syntax exclusion | Confirm selecting rendered italic text mirrors `italic text`, not `_italic text_`. | Pass: both `_` markers are excluded from the mirrored selection. |
| SM-020 | Bold italic exact | Select rendered `bold italic text`. | Pass: the `***` wrappers are excluded, so the mirror is exactly `bold italic text` (verified live; closing `***` no longer leaks). |
| SM-021 | Across emphasis boundary | Select from the end of `bold text` through the start of `italic text`, including the rendered comma and space. | Expected limitation: outer markers are excluded, but a selection that spans from one span into the next necessarily contains the source markers that sit between them (`**`/`_` around the comma); those interior markers cannot be excluded from a contiguous range. |
| SM-022 | Inline code exact | Select rendered `inline code`. | Pass: both backtick delimiters are excluded, so the mirror is exactly `inline code`. |
| SM-023 | Inline code syntax exclusion | Confirm selecting rendered inline code mirrors `inline code`, not `` `inline code` ``. | Pass: selecting rendered inline code now mirrors `inline code` with both backticks excluded. |
| SM-024 | Inline code with underscore | Select rendered `inline_task_code` in the Task List section. | Pass: inline-code contents are now treated literally, so the underscores are preserved and only the backticks are stripped; the mirror is exactly `inline_task_code`. |
| SM-035 | Task bold text | Select rendered `bold task text`. | Pass: uses the same bold-wrapper stripping as SM-014, so the `**` wrappers are excluded from the task-item mirror. |
| SM-052 | Nested bold italic text | Select rendered `italic inside bold` inside nested emphasis. | Pass: markers are stripped at each nesting level, so selecting the inner italic span mirrors exactly `italic inside bold` without the nested `_` or surrounding `**`. |
| SM-062 | Backward drag out of a bold span | Double-click `bold` inside `**bold text**`, then drag backward past the start of the word into the preceding space (final selection ` bold`). | Pass (previously failed): preview selections are now mirrored only after the gesture settles (on mouse/key release), never during the drag, so the transient mid-drag collapses that produced the degenerate single-space range never reach the editor. The settled ` bold` selection maps to `·**bold` — the leading space plus the opening markers (included per the markers-shown-when-entering-a-span-from-outside limitation), excluding `text` and the closing `**`. Verified live. The earlier span-extension heuristic was removed: it over-expanded a settled selection ending exactly at a span's content start (for example selecting only the space before the span) to cover the whole span, which this settle-on-release model no longer needs and which was itself a defect. |
| SM-054 | Nested struck text and code | Select across `struck text` and rendered `code` inside strikethrough. | Pass for the strikethrough wrappers: the outer `~~` are now excluded and the inner code contents stay literal. Note: a selection spanning both the struck text and the nested code span still contains the interior code backticks, which sit between the two selected runs and cannot be excluded from a contiguous range. |
| SM-063 | Backward drag to exactly the word start | Double-click `bold` inside `**bold text**`, then drag backward to exactly the start of the word (not into the preceding space) and release, leaving `bold` still highlighted in the preview. | Fail (reopened): taking the selection extent from `Selection.getRangeAt(0)` instead of anchor/focus was a real, verified improvement (see the code note in `previewSelectionToEditorSelection`) and fixed the related click-to-deselect case (SM-064), but live user testing after that change confirmed this exact gesture still leaves the word unmirrored in the editor. The automated sessions that attempted this fix could not reliably synthesize the precise word-granularity drag-to-boundary gesture, so the fix landed without ever being confirmed against the real gesture. Root cause not yet fully understood; revisit with a live-input-capable session. |

## 4. Fix Links After Inline Formatting Is Reliable

Link labels need the same boundary precision as styled text, plus exclusion of hidden destination syntax. Handle full-label, partial-label, task-link, and linked-inline-code selections without pulling in brackets, URLs, or code markers.

| ID | Name | Description | Status |
| --- | --- | --- | --- |
| SM-025 | Link label exact | Select rendered `link label`. | Pass (previously failed; doc was stale): `[`/`]` brackets and the `(destination)` URL are stripped from the plain character stream, so selecting the rendered label mirrors exactly `link label`. Verified live (offsets 483–493). |
| SM-026 | Link URL exclusion | Confirm selecting rendered link text mirrors `link label`, not `[link label](https://example.com/selection-test)`. | Pass: selecting the rendered link text mirrors `link label`; no brackets or URL destination are included. Verified live. |
| SM-027 | Link partial label | Select only `label` within the rendered link. | Pass: selecting only `label` mirrors exactly `label`; the trailing `]` and URL destination are excluded. Verified live. |
| SM-028 | Across link boundary | Select from text before the link into `link label`. | Expected limitation: the outer link syntax is excluded at each endpoint, but a selection that runs from text before the link into the label necessarily contains the opening `[` that sits between the two runs in source, so the mirror is `and a [link label`. Selecting only the label (SM-025) is clean. This is the same contiguous-range constraint as SM-016 and SM-021. Verified live. |
| SM-037 | Task link label | Select rendered `task link`. | Pass: the task-list line prefixes (`- ` and `[x] `) plus the link brackets and URL are all stripped, so selecting the rendered task link mirrors exactly `task link`. Verified live. |
| SM-053 | Nested linked inline code | Select rendered `linked inline code`. | Pass: inline code inside a link label composes correctly — the backtick delimiters, link brackets, URL destination, and the blockquote/ordered-list line prefixes are all excluded, so the mirror is exactly `linked inline code`. Verified live. |

## 5. Address Encoded And Transformed Text

Decode or otherwise account for HTML entities so rendered characters map back to the intended source span. Keep literal-symbol behavior covered as a control case.

| ID | Name | Description | Status |
| --- | --- | --- | --- |
| SM-044 | Named HTML entity single character | Select rendered `&`, `<`, `>`, `"`, `'`, copyright, em dash, or non-breaking space from the named-entity line. | Pass: `markdownPlainChars` now decodes each HTML entity reference to the single character it renders as and collapses the whole `&…;` source span onto that one character, so selecting any rendered entity character mirrors to its exact source entity. Named references (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&copy;`, `&mdash;`, `&nbsp;`, …) and numeric references (`&#NNN;`/`&#xHHH;`) are covered; the non-breaking space maps one-to-one instead of collapsing into an adjacent ordinary space. |
| SM-045 | Named HTML entity run | Select a run crossing multiple rendered entity characters. | Pass: a run spanning several rendered entity characters mirrors to the contiguous source span covering each `&…;` reference and the literal spacing between them. |
| SM-046 | Literal equivalent symbols | Select symbols from the literal comparison line. | Pass. A bare `&` that does not begin a recognized reference still falls back to literal handling, so the literal comparison line is unaffected by entity decoding. |
| SM-050 | Footnote inline code with underscore | Select rendered `footnote_code`. | Pass: the underscore was already preserved by inline-code literal handling; the remaining shift was footnote-specific — the footnote definition label (`[^name]: `) was not stripped, offsetting the whole body. The line-prefix stripper now removes that label, so `footnote_code` (and the footnote body's bold span and link label) mirror to their exact source. |

## 6. Revisit Complex Block Structures As Best-Effort Improvements

Tables, task checkboxes, images, raw HTML, generated anchors, footnotes, nested cross-block selections, and plugin-rendered content can remain approximate, but any improvements should come after basic prose, headings, inline formatting, and links are dependable.

| ID | Name | Description | Status |
| --- | --- | --- | --- |
| SM-029 | Table plain cell text | Select rendered `URL is hidden in preview` inside a table cell. | Expected limitation: maps to a nearby source span; exact source may include table pipe structure or shifted offsets. |
| SM-030 | Table bold cell text | Select rendered `bold cell text` in the Emphasis row. | Expected limitation: nearby-span behavior is acceptable for tables; exact character mirroring is not reliable. |
| SM-031 | Table inline code cell | Select rendered `cell_code()`. | Expected limitation: table syntax and hidden code markers make exact offsets unreliable. |
| SM-032 | Table link cell | Select rendered `cell link`. | Expected limitation: URL should generally be avoided, but source offsets may be approximate because table pipes are not visible in preview. |
| SM-033 | Across table cells | Select from one rendered table cell into the next. | Expected limitation: selection maps near the row source rather than exact cell text. |
| SM-034 | Task text only | Select `Unchecked task item with bold task text` without the checkbox. | Pass |
| SM-036 | Task checkbox into text | Start selection on the checkbox region and drag into task text. | Expected limitation: checkbox DOM is generated from Markdown task syntax and may map to the nearest source text boundary. |
| SM-038 | Image element | Select or drag across the rendered image itself. | Expected limitation: image DOM has no selectable text equivalent; editor selection may land on the image Markdown line or nearby text. |
| SM-039 | Image adjacent paragraph | Select text in the paragraph below the image. | Pass |
| SM-040 | Raw HTML heading | Select rendered `Raw HTML Heading`. | Expected limitation: source contains HTML tags that are hidden in preview, so exact character mapping is not expected. |
| SM-041 | Raw HTML strong text | Select rendered `strong HTML text`. | Expected limitation: maps near the raw HTML source span and may include or skip tag-adjacent source characters. |
| SM-042 | Raw HTML code text | Select rendered `htmlCode()`. | Expected limitation: raw `<code>` tags are hidden in preview, so exact syntax exclusion is not reliable. |
| SM-043 | Raw HTML link text | Select rendered `Raw HTML link text`. | Expected limitation: raw `href` syntax can affect source offsets; label-only mirroring is not guaranteed. |
| SM-047 | Footnote reference marker | Select the rendered footnote reference marker. | Expected limitation: rendered reference text does not resemble the `[^selection-footnote]` source marker. |
| SM-048 | Footnote sentence text | Select sentence text before the footnote reference. | Pass |
| SM-049 | Rendered footnote body text | Select rendered footnote body text. | Expected limitation: rendered footnotes may be relocated in the preview DOM, so nearby source-span mapping is acceptable. |
| SM-051 | Nested blockquote text | Select `First nested item` inside the blockquote list. | Pass |
| SM-055 | Across nested list items | Select from the first nested list item into the second. | Expected limitation: blockquote and list prefixes between endpoints can make source content differ from rendered preview content. |
| SM-056 | Mermaid fenced block as code | If Mermaid is not rendered by a plugin, select visible code text in the fenced block. | Expected limitation: fence markers and language info are hidden or transformed, so exact mapping is not guaranteed. |
| SM-057 | Mermaid rendered diagram | If Mermaid renders as a diagram, select diagram text such as `Preview Selection`. | Expected limitation: plugin-generated DOM can only map to a nearby source span. |
| SM-058 | Math block | Select rendered `E = mc^2` or transformed math output. | Expected limitation: plugin or code-fence rendering may not preserve exact source characters. |
| SM-059 | ABC block | Select rendered ABC notation or transformed music output. | Expected limitation: plugin-rendered content may map to the fenced source block rather than exact characters. |
| SM-060 | Cross plain paragraphs | Select from `Start selecting in this paragraph.` into the next plain paragraph. | Pass |
| SM-061 | Cross paragraph into blockquote | Continue a selection from the second plain paragraph into the blockquote. | Expected limitation: source selection can include block boundary and blockquote marker syntax not visible in preview. |

## Summary

The strongest behavior is for simple prose, headings, and partial selections within formatted spans. Those cases generally preserve selection direction, support letter/word/paragraph gestures, and keep normal internal spaces aligned.

Baseline prose and whitespace handling are now stable: selected whitespace at paragraph edges and immediately before styled spans maps to the exact source characters (SM-007, SM-008). Simple inline formatting wrappers are now stripped: selecting rendered bold, italic, bold italic, inline code, and strikethrough spans mirrors the content only, with the opening and closing markers excluded (SM-014, SM-017–SM-020, SM-022–SM-024, SM-035, SM-052, SM-054). Inline code contents — including marker characters such as `_` — are preserved literally. Link labels behave the same way: selecting a rendered link label, a partial label, a task-list link, or a link whose label is inline code mirrors the label text only, excluding the `[`/`]` brackets and the `(destination)` URL (SM-025–SM-027, SM-037, SM-053). The residual inline cases are inherent to contiguous-range mapping: a selection that crosses from a styled span or a link into adjacent punctuation or a neighbouring span still contains the source markers that lie between the two selected runs (SM-016, SM-021, the opening `[` in SM-028, and the code delimiters within SM-054). HTML entities are now decoded before offset matching: each `&…;` reference collapses to the single character it renders, so selecting a rendered entity character or a run of them mirrors to the exact source entities (SM-044, SM-045), while a bare ampersand stays literal (SM-046). The footnote-body code case is also resolved (SM-050): the underscore was already preserved by inline-code handling, and stripping the footnote definition label (`[^name]: `) removes the body-wide offset that had been the real cause. Complex rendered structures match the expected best-effort behavior: tables, task checkboxes, images, raw HTML, generated anchors, footnotes, nested cross-block selections, and plugin-rendered blocks can land on a nearby source span rather than exact selected characters.
