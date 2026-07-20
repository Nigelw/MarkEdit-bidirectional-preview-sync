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

type Normalized = {
  text: string;
  sourceStarts: number[];
  sourceEnds: number[];
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

  const anchorPos = sourcePosForEndpoint(anchor, doc, 'anchor');
  const focusPos = sourcePosForEndpoint(focus, doc, 'focus');
  if (anchorPos === undefined || focusPos === undefined || anchorPos === focusPos) {
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

function sourcePosForEndpoint(
  endpoint: Endpoint,
  doc: DocumentText,
  side: 'anchor' | 'focus',
): number | undefined {
  const sourceRange = sourceRangeForBlock(endpoint.block, doc);
  if (sourceRange === undefined) {
    return undefined;
  }

  const domText = endpoint.block.element.textContent ?? '';
  if (domText.length === 0) {
    return side === 'anchor' ? sourceRange.from : sourceRange.to;
  }

  const renderedOffset = renderedOffsetInBlock(endpoint.block.element, endpoint.node, endpoint.offset);
  if (renderedOffset === undefined) {
    return side === 'anchor' ? sourceRange.from : sourceRange.to;
  }

  const source = doc.sliceString(sourceRange.from, sourceRange.to);
  const plain = markdownPlainChars(source, sourceRange.from);
  const normalizedSource = normalizePlainChars(plain);
  const normalizedBefore = normalizeText(domText.slice(0, renderedOffset)).length;
  const normalizedFull = normalizeText(domText).length;

  if (normalizedSource.sourceStarts.length === 0) {
    return side === 'anchor' ? sourceRange.from : sourceRange.to;
  }

  return sourcePositionForRenderedOffset(normalizedBefore, normalizedFull, normalizedSource);
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

function sourcePositionForRenderedOffset(
  renderedOffset: number,
  renderedLength: number,
  source: Normalized,
): number {
  if (renderedOffset <= 0) {
    return source.sourceStarts[0];
  }

  if (renderedOffset >= renderedLength) {
    return source.sourceEnds[source.sourceEnds.length - 1];
  }

  const index = sourceIndexForRenderedOffset(renderedOffset, renderedLength, source);
  return source.sourceStarts[index];
}

function sourceIndexForRenderedOffset(renderedOffset: number, renderedLength: number, source: Normalized): number {
  if (source.text.length === renderedLength) {
    return clamp(renderedOffset, 0, source.sourceStarts.length - 1);
  }

  if (renderedLength <= 0 || source.text.length <= 1) {
    return renderedOffset <= 0 ? 0 : source.sourceStarts.length - 1;
  }

  const ratio = clamp(renderedOffset / renderedLength, 0, 1);
  return clamp(Math.round(ratio * (source.sourceStarts.length - 1)), 0, source.sourceStarts.length - 1);
}

function normalizeText(text: string): string {
  return normalizePlainChars(Array.from(text, (char, index) => ({ char, sourcePos: index, sourceEndPos: index + char.length }))).text;
}

function normalizePlainChars(chars: readonly PlainChar[]): Normalized {
  let text = '';
  const sourceStarts: number[] = [];
  const sourceEnds: number[] = [];
  let pendingSpace: PlainChar | undefined;

  for (const item of chars) {
    if (/\s/.test(item.char)) {
      pendingSpace = item;
      continue;
    }

    if (pendingSpace !== undefined && text.length > 0) {
      text += ' ';
      sourceStarts.push(pendingSpace.sourcePos);
      sourceEnds.push(pendingSpace.sourceEndPos);
    }

    text += item.char;
    sourceStarts.push(item.sourcePos);
    sourceEnds.push(item.sourceEndPos);
    pendingSpace = undefined;
  }

  return { text, sourceStarts, sourceEnds };
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
  return char === '*' || char === '_' || char === '~' || char === '`';
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
