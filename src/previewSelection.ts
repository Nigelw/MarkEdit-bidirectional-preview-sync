import { EditorSelection } from '@codemirror/state';
import type { SelectionRange, Text as DocumentText } from '@codemirror/state';

import type { BlockEntry } from './previewBlocks';

export type SelectionMapping = {
  selection: EditorSelection;
  range: SelectionRange;
};

type Endpoint = {
  block: BlockEntry;
  node: Node;
  offset: number;
};

type PlainChar = {
  char: string;
  sourcePos: number;
  sourceEndPos: number;
};

export function previewSelectionToEditorSelection(
  selection: Selection,
  previewPane: HTMLElement,
  entries: readonly BlockEntry[],
  doc: DocumentText,
): SelectionMapping | undefined {
  if (selection.isCollapsed || selection.anchorNode === null || selection.focusNode === null) {
    return undefined;
  }

  if (!previewPane.contains(selection.anchorNode) || !previewPane.contains(selection.focusNode)) {
    return undefined;
  }

  const anchor = endpointFor(selection.anchorNode, selection.anchorOffset, previewPane, entries);
  const focus = endpointFor(selection.focusNode, selection.focusOffset, previewPane, entries);
  if (anchor === undefined || focus === undefined) {
    return undefined;
  }

  const anchorInfo = endpointSourceInfo(anchor, doc);
  const focusInfo = endpointSourceInfo(focus, doc);
  if (anchorInfo === undefined || focusInfo === undefined) {
    return undefined;
  }

  // Decide which endpoint is the lower (start) and which is the upper (end) of the
  // selection in document order. The lower boundary maps to the leading source
  // position of the first selected character; the upper boundary maps to the
  // trailing source position of the last selected character. Using these two
  // sides — rather than the leading position for both — excludes closing syntax
  // markers (e.g. the `**` after `bold text`) that sit between the last content
  // character and the next one.
  const anchorIsLower = compareEndpointInfo(anchorInfo, focusInfo) <= 0;
  const anchorPos = anchorIsLower ? anchorInfo.leading : anchorInfo.trailing;
  const focusPos = anchorIsLower ? focusInfo.trailing : focusInfo.leading;
  if (anchorPos === focusPos) {
    return undefined;
  }

  const editorRange = EditorSelection.range(anchorPos, focusPos);
  return {
    selection: EditorSelection.create([editorRange]),
    range: editorRange,
  };
}

function endpointFor(
  node: Node,
  offset: number,
  previewPane: HTMLElement,
  entries: readonly BlockEntry[],
): Endpoint | undefined {
  const directBlock = blockElementFor(node, previewPane);
  if (directBlock !== undefined) {
    const block = entries.find(entry => entry.element === directBlock);
    if (block !== undefined) {
      return { block, node, offset };
    }
  }

  const point = pointFromContainerOffset(node, offset);
  const nearest = point === undefined ? undefined : nearestBlockForPoint(point, previewPane, entries);
  if (nearest === undefined) {
    return undefined;
  }

  return {
    block: nearest.block,
    node: nearest.node,
    offset: nearest.offset,
  };
}

function blockElementFor(node: Node, previewPane: HTMLElement): HTMLElement | undefined {
  let current: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (current !== null && current !== previewPane) {
    if (current instanceof HTMLElement && current.dataset.lineFrom !== undefined) {
      return current;
    }
    current = current.parentNode;
  }
  return undefined;
}

function pointFromContainerOffset(node: Node, offset: number): Node | undefined {
  if (node.nodeType === Node.TEXT_NODE) {
    return node;
  }

  const children = node.childNodes;
  if (children.length === 0) {
    return node;
  }

  return children[Math.min(offset, children.length - 1)];
}

function nearestBlockForPoint(
  node: Node,
  previewPane: HTMLElement,
  entries: readonly BlockEntry[],
): { block: BlockEntry; node: Node; offset: number } | undefined {
  const ordered = Array.from(entries).sort((a, b) => a.top - b.top);
  const pointElement = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  if (pointElement === null) {
    return undefined;
  }

  const pointTop = pointElement instanceof HTMLElement
    ? pointElement.offsetTop
    : 0;
  const fallback = ordered.find(entry => entry.element.contains(node)) ?? ordered[0];
  if (fallback === undefined) {
    return undefined;
  }

  const block = ordered.find(entry => {
    const bottom = entry.top + entry.height;
    return pointTop >= entry.top && pointTop <= bottom;
  }) ?? fallback;
  const text = firstTextNode(block.element);
  return {
    block,
    node: text ?? block.element,
    offset: text === undefined ? 0 : 0,
  };
}

function firstTextNode(element: HTMLElement): globalThis.Text | undefined {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  return walker.nextNode() as globalThis.Text | null ?? undefined;
}

// Source positions for a single selection endpoint. `leading` is the source
// offset to use when this endpoint is the lower (start) boundary of the
// selection; `trailing` is the offset to use when it is the upper (end)
// boundary. `blockFrom` and `order` establish document order between the two
// endpoints so we can tell which side each one is.
type EndpointSourceInfo = {
  blockFrom: number;
  order: number;
  leading: number;
  trailing: number;
};

function endpointSourceInfo(endpoint: Endpoint, doc: DocumentText): EndpointSourceInfo | undefined {
  const sourceRange = sourceRangeForBlock(endpoint.block, doc);
  if (sourceRange === undefined) {
    return undefined;
  }

  const blockFrom = endpoint.block.from;
  const domText = endpoint.block.element.textContent ?? '';
  if (domText.length === 0) {
    return { blockFrom, order: 0, leading: sourceRange.from, trailing: sourceRange.to };
  }

  const renderedOffset = renderedOffsetInBlock(endpoint.block.element, endpoint.node, endpoint.offset);
  if (renderedOffset === undefined) {
    return { blockFrom, order: 0, leading: sourceRange.from, trailing: sourceRange.to };
  }

  const source = doc.sliceString(sourceRange.from, sourceRange.to);
  const plain = markdownPlainChars(source, sourceRange.from);
  if (plain.length === 0) {
    return { blockFrom, order: renderedOffset, leading: sourceRange.from, trailing: sourceRange.to };
  }

  const map = renderedToSourceMap(domText, plain, sourceRange);
  const index = clamp(renderedOffset, 0, domText.length);
  return { blockFrom, order: index, leading: map.starts[index], trailing: map.ends[index] };
}

function compareEndpointInfo(a: EndpointSourceInfo, b: EndpointSourceInfo): number {
  if (a.blockFrom !== b.blockFrom) {
    return a.blockFrom - b.blockFrom;
  }
  return a.order - b.order;
}

function sourceRangeForBlock(block: BlockEntry, doc: DocumentText): { from: number; to: number } | undefined {
  const fromLine = block.from + 1;
  const toLine = block.to + 1;
  if (fromLine < 1 || fromLine > doc.lines || toLine < 1) {
    return undefined;
  }

  const from = doc.line(fromLine).from;
  const to = doc.line(Math.min(toLine, doc.lines)).to;
  return { from, to };
}

function renderedOffsetInBlock(block: HTMLElement, node: Node, offset: number): number | undefined {
  const range = document.createRange();
  try {
    range.setStart(block, 0);
    range.setEnd(node, offset);
    return range.toString().length;
  } catch {
    return undefined;
  } finally {
    range.detach();
  }
}

// Aligns the block's rendered text against the marker-stripped source characters
// and returns, for every rendered offset (0..rendered.length inclusive), the source
// position it maps to. Unlike a normalized/collapsed comparison, this preserves the
// exact whitespace a user selects in the preview: a selected space maps to the source
// space, paragraph-edge whitespace maps to the matching source characters, and the
// leading space before a styled span is kept instead of being trimmed to the span.
function renderedToSourceMap(rendered: string, plain: readonly PlainChar[], sourceRange: { from: number; to: number }): { starts: number[]; ends: number[] } {
  // starts[r] = leading source position for a selection whose lower boundary is
  // rendered offset r (the start of the character at r).
  // ends[r]   = trailing source position for a selection whose upper boundary is
  // rendered offset r (the end of the character just before r). Because markers
  // are absent from `plain`, `ends[r]` stops at the last content character and
  // excludes any closing syntax that precedes the next content character.
  const starts: number[] = new Array(rendered.length + 1);
  const ends: number[] = new Array(rendered.length + 1);
  const startPos = plain[0]?.sourcePos ?? sourceRange.from;
  const endPos = plain[plain.length - 1]?.sourceEndPos ?? sourceRange.to;
  let p = 0;
  let prevEnd = startPos;

  for (let r = 0; r <= rendered.length; r += 1) {
    // A rendered non-space character never corresponds to leading source whitespace,
    // so skip any pending source whitespace before recording its position. Rendered
    // whitespace, by contrast, should map onto the first source whitespace character.
    if (r < rendered.length && !isSpace(rendered[r])) {
      while (p < plain.length && isSpace(plain[p].char)) {
        p += 1;
      }
    }

    starts[r] = p < plain.length ? plain[p].sourcePos : endPos;
    ends[r] = prevEnd;
    if (r === rendered.length) {
      break;
    }

    if (isSpace(rendered[r])) {
      // Collapse a run of source whitespace onto this single rendered whitespace.
      let lastEnd = starts[r];
      while (p < plain.length && isSpace(plain[p].char)) {
        lastEnd = plain[p].sourceEndPos;
        p += 1;
      }
      prevEnd = lastEnd;
    } else if (p < plain.length) {
      // Advance past the matched source character. When the characters disagree
      // (e.g. HTML entities or leftover markers) fall back to a one-to-one advance.
      prevEnd = plain[p].sourceEndPos;
      p += 1;
    } else {
      prevEnd = endPos;
    }
  }

  return { starts, ends };
}

function isSpace(char: string): boolean {
  return /\s/.test(char);
}

function markdownPlainChars(source: string, basePos: number): PlainChar[] {
  const chars: PlainChar[] = [];
  let lineStart = true;
  let i = 0;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (lineStart) {
      const skipped = linePrefixLength(source, i);
      if (skipped > 0) {
        i += skipped;
        continue;
      }
    }

    if (char === '\n') {
      chars.push({ char, sourcePos: basePos + i, sourceEndPos: basePos + i + 1 });
      lineStart = true;
      i += 1;
      continue;
    }

    lineStart = false;

    if (char === '\\' && next !== undefined) {
      chars.push({ char: next, sourcePos: basePos + i + 1, sourceEndPos: basePos + i + 2 });
      i += 2;
      continue;
    }

    // Inline code spans render their contents literally, so characters that would
    // otherwise be emphasis markers (`_`, `*`, `~`) must be kept verbatim. Only the
    // surrounding backtick delimiters are stripped. The delimiter run length must
    // match on both sides (CommonMark code spans).
    if (char === '`') {
      let runLength = 1;
      while (source[i + runLength] === '`') {
        runLength += 1;
      }

      const contentStart = i + runLength;
      const closeStart = codeSpanCloseStart(source, contentStart, runLength);
      if (closeStart !== -1) {
        let start = contentStart;
        let end = closeStart;
        // CommonMark strips a single leading and trailing space when both are
        // present and the content is not all spaces, matching what is rendered.
        if (end - start >= 2 && source[start] === ' ' && source[end - 1] === ' ' && !isAllSpaces(source, start, end)) {
          start += 1;
          end -= 1;
        }
        for (let j = start; j < end; j += 1) {
          chars.push({ char: source[j], sourcePos: basePos + j, sourceEndPos: basePos + j + 1 });
        }
        i = closeStart + runLength;
        continue;
      }
      // No matching closing run: treat the backticks as literal content.
      chars.push({ char, sourcePos: basePos + i, sourceEndPos: basePos + i + 1 });
      i += 1;
      continue;
    }

    if (isFormattingMarker(char)) {
      i += markerRunLength(source, i, char);
      continue;
    }

    if (char === '[' || char === ']') {
      i += 1;
      continue;
    }

    if (char === '(' && preceding(source, i) === ']' && looksLikeLinkDestination(source, i)) {
      i = skipBalancedLinkDestination(source, i);
      continue;
    }

    if (char === '!' && next === '[') {
      i += 1;
      continue;
    }

    chars.push({ char, sourcePos: basePos + i, sourceEndPos: basePos + i + 1 });
    i += 1;
  }

  return chars;
}

function linePrefixLength(source: string, index: number): number {
  const match = /^(?:[ \t]{0,3}(?:#{1,6}[ \t]+|>[ \t]?|[-+*][ \t]+|\d+[.)][ \t]+|\[[ xX]\][ \t]+))/.exec(source.slice(index));
  return match?.[0].length ?? 0;
}

function isFormattingMarker(char: string): boolean {
  return char === '*' || char === '_' || char === '~';
}

// Finds the start index of the first backtick run of exactly `runLength` that
// closes a code span opened at `contentStart`, or -1 when none exists.
function codeSpanCloseStart(source: string, contentStart: number, runLength: number): number {
  let i = contentStart;
  while (i < source.length) {
    if (source[i] === '`') {
      let length = 1;
      while (source[i + length] === '`') {
        length += 1;
      }
      if (length === runLength) {
        return i;
      }
      i += length;
    } else {
      i += 1;
    }
  }
  return -1;
}

function isAllSpaces(source: string, start: number, end: number): boolean {
  for (let i = start; i < end; i += 1) {
    if (source[i] !== ' ') {
      return false;
    }
  }
  return true;
}

function markerRunLength(source: string, index: number, marker: string): number {
  let length = 1;
  while (source[index + length] === marker && length < 3) {
    length += 1;
  }
  return length;
}

function preceding(source: string, index: number): string | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!/\s/.test(source[i])) {
      return source[i];
    }
  }
  return undefined;
}

function looksLikeLinkDestination(source: string, index: number): boolean {
  return source.slice(0, index).lastIndexOf(']') > source.slice(0, index).lastIndexOf('[');
}

function skipBalancedLinkDestination(source: string, index: number): number {
  let depth = 0;
  for (let i = index; i < source.length; i += 1) {
    if (source[i] === '(') {
      depth += 1;
    } else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }
  }
  return index + 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
