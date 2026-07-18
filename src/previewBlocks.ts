export type BlockEntry = {
  element: HTMLElement;
  from: number;
  to: number;
  top: number;
  height: number;
};

export class PreviewBlockIndex {
  private container: HTMLElement | undefined;
  private entries: BlockEntry[] = [];
  private dirty = true;
  private observer: MutationObserver | undefined;
  private rebuildFrame: number | undefined;

  attach(container: HTMLElement): void {
    if (this.container === container) {
      return;
    }

    this.detach();
    this.container = container;
    this.dirty = true;
    this.observer = new MutationObserver(() => this.markDirty());
    this.observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-line-from', 'data-line-to', 'style', 'class'],
    });
  }

  detach(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.rebuildFrame !== undefined) {
      cancelAnimationFrame(this.rebuildFrame);
      this.rebuildFrame = undefined;
    }
    this.container = undefined;
    this.entries = [];
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
    if (this.rebuildFrame !== undefined) {
      return;
    }

    this.rebuildFrame = requestAnimationFrame(() => {
      this.rebuildFrame = undefined;
      this.rebuild();
    });
  }

  all(): BlockEntry[] {
    if (this.dirty) {
      this.rebuild();
    }
    return this.entries;
  }

  atLine(line: number): BlockEntry | undefined {
    const entries = this.all();
    let low = 0;
    let high = entries.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const entry = entries[mid];
      if (line < entry.from) {
        high = mid - 1;
      } else if (line > entry.to) {
        low = mid + 1;
      } else {
        return entry;
      }
    }

    return undefined;
  }

  enclosingLine(line: number): { before?: BlockEntry; after?: BlockEntry } {
    const entries = this.all();
    let low = 0;
    let high = entries.length - 1;
    let before: BlockEntry | undefined;
    let after: BlockEntry | undefined;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const entry = entries[mid];
      if (entry.to < line) {
        before = entry;
        low = mid + 1;
      } else if (entry.from > line) {
        after = entry;
        high = mid - 1;
      } else {
        return { before: entry, after: entry };
      }
    }

    return { before, after };
  }

  atY(y: number): BlockEntry | undefined {
    const entries = this.all();
    let low = 0;
    let high = entries.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const entry = entries[mid];
      const bottom = entry.top + entry.height;
      if (y < entry.top) {
        high = mid - 1;
      } else if (y > bottom) {
        low = mid + 1;
      } else {
        return entry;
      }
    }

    return undefined;
  }

  enclosingY(y: number): { before?: BlockEntry; after?: BlockEntry } {
    const entries = this.all();
    let low = 0;
    let high = entries.length - 1;
    let before: BlockEntry | undefined;
    let after: BlockEntry | undefined;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const entry = entries[mid];
      const bottom = entry.top + entry.height;
      if (bottom < y) {
        before = entry;
        low = mid + 1;
      } else if (entry.top > y) {
        after = entry;
        high = mid - 1;
      } else {
        return { before: entry, after: entry };
      }
    }

    return { before, after };
  }

  private rebuild(): void {
    const container = this.container;
    if (container === undefined) {
      this.entries = [];
      this.dirty = false;
      return;
    }

    this.entries = Array.from(container.querySelectorAll<HTMLElement>('[data-line-from]'))
      .map(element => entryFor(container, element))
      .filter(entry => entry !== undefined)
      .sort((a, b) => a.from - b.from || a.top - b.top);

    this.dirty = false;
  }
}

function entryFor(container: HTMLElement, element: HTMLElement): BlockEntry | undefined {
  const from = parseLine(element.dataset.lineFrom);
  const to = parseLine(element.dataset.lineTo);
  if (from === undefined || to === undefined) {
    return undefined;
  }

  return {
    element,
    from,
    to: Math.max(from, to),
    top: elementTop(container, element),
    height: Math.max(1, element.offsetHeight),
  };
}

function parseLine(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function elementTop(container: HTMLElement, element: HTMLElement): number {
  let top = 0;
  let current: HTMLElement | null = element;

  while (current !== null && current !== container) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }

  return top;
}
