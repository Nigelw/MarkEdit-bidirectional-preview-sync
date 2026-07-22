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
| SM-014 | Bold text exact | Select rendered `bold text`. | Fail: mirrored editor selection can include the Markdown wrapper, e.g. `**bold text**`, instead of only `bold text`. |
| SM-015 | Bold text partial word | Select only `old tex` inside rendered bold text. | Pass |
| SM-016 | Bold text with adjacent comma | Select `bold text,` including the rendered comma after the bold span. | Fail: mirrored editor selection can include hidden bold markers around `bold text` in addition to the comma. |
| SM-017 | Bold syntax exclusion | Confirm selecting rendered bold text mirrors `bold text`, not `**bold text**`. | Fail: selecting rendered bold text can mirror `**bold text**`, including both opening and closing markers. |
| SM-018 | Italic text exact | Select rendered `italic text`. | Fail: mirrored editor selection can include the Markdown wrapper, e.g. `_italic text_`, instead of only `italic text`. |
| SM-019 | Italic syntax exclusion | Confirm selecting rendered italic text mirrors `italic text`, not `_italic text_`. | Fail: selecting rendered italic text can mirror `_italic text_`, including both opening and closing markers. |
| SM-020 | Bold italic exact | Select rendered `bold italic text`. | Fail: mirrored editor selection can include the Markdown wrapper, e.g. `***bold italic text***`, instead of only `bold italic text`. |
| SM-021 | Across emphasis boundary | Select from the end of `bold text` through the start of `italic text`, including the rendered comma and space. | Fail: mirrored editor selection includes hidden emphasis syntax at or between the rendered spans. |
| SM-022 | Inline code exact | Select rendered `inline code`. | Fail: mirrored editor selection can include the Markdown wrapper, e.g. `` `inline code` ``, instead of only `inline code`. |
| SM-023 | Inline code syntax exclusion | Confirm selecting rendered inline code mirrors `inline code`, not `` `inline code` ``. | Fail: selecting rendered inline code can mirror `` `inline code` ``, including both backticks. |
| SM-024 | Inline code with underscore | Select rendered `inline_task_code` in the Task List section. | Fail: underscore is treated as a Markdown formatting marker, so mirrored source can lose or misplace `_`. |
| SM-035 | Task bold text | Select rendered `bold task text`. | Fail: mirrored editor selection can include the Markdown wrapper, e.g. `**bold task text**`, matching the simple bold failure. |
| SM-052 | Nested bold italic text | Select rendered `italic inside bold` inside nested emphasis. | Fail: mirrored editor selection can include hidden emphasis markers from the nested source. |
| SM-054 | Nested struck text and code | Select across `struck text` and rendered `code` inside strikethrough. | Fail: full-span strikethrough selections can include hidden `~~` syntax. |

## 4. Fix Links After Inline Formatting Is Reliable

Link labels need the same boundary precision as styled text, plus exclusion of hidden destination syntax. Handle full-label, partial-label, task-link, and linked-inline-code selections without pulling in brackets, URLs, or code markers.

| ID | Name | Description | Status |
| --- | --- | --- | --- |
| SM-025 | Link label exact | Select rendered `link label`. | Fail: mirrored editor selection can include the Markdown link wrapper, e.g. `[link label](https://example.com/selection-test)`, instead of only `link label`. |
| SM-026 | Link URL exclusion | Confirm selecting rendered link text mirrors `link label`, not `[link label](https://example.com/selection-test)`. | Fail: selecting rendered link text can include brackets and URL destination syntax. |
| SM-027 | Link partial label | Select only `label` within the rendered link. | Fail: ending at the label boundary can still include link syntax and URL destination text. |
| SM-028 | Across link boundary | Select from text before the link into `link label`. | Fail: mirrored editor selection can include link brackets and destination syntax. |
| SM-037 | Task link label | Select rendered `task link`. | Fail: mirrored editor selection can include brackets and URL destination syntax. |
| SM-053 | Nested linked inline code | Select rendered `linked inline code`. | Fail: linked inline-code selections can include hidden code markers, link brackets, and URL destination syntax. |

## 5. Address Encoded And Transformed Text

Decode or otherwise account for HTML entities so rendered characters map back to the intended source span. Keep literal-symbol behavior covered as a control case.

| ID | Name | Description | Status |
| --- | --- | --- | --- |
| SM-044 | Named HTML entity single character | Select rendered `&`, `<`, `>`, `"`, `'`, copyright, em dash, or non-breaking space from the named-entity line. | Fail: entity source text such as `&amp;` is not decoded before offset matching, so exact character selection does not match rendered characters. |
| SM-045 | Named HTML entity run | Select a run crossing multiple rendered entity characters. | Fail: mirrored editor selection targets source entity text, not the rendered character sequence. |
| SM-046 | Literal equivalent symbols | Select symbols from the literal comparison line. | Pass |
| SM-050 | Footnote inline code with underscore | Select rendered `footnote_code`. | Fail: underscore is treated as formatting syntax, so exact code content is not preserved. |

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

Baseline prose and whitespace handling are now stable: selected whitespace at paragraph edges and immediately before styled spans maps to the exact source characters (SM-007, SM-008). The main remaining failures are full-span syntax exclusion for emphasis, inline code, strikethrough, and links; HTML entity decoding; and inline code containing marker characters such as `_`. Complex rendered structures match the expected best-effort behavior: tables, task checkboxes, images, raw HTML, generated anchors, footnotes, nested cross-block selections, and plugin-rendered blocks can land on a nearby source span rather than exact selected characters.
