export interface MeasuredPdfBlock {
  key: string;
  height: number;
  keepNext?: boolean;
  continuationKey?: string;
  continuationHeight?: number;
  pairWithNext?: boolean;
}

export interface PdfPageItem {
  keys: string[];
  continuation?: boolean;
}

/** Preserve reading order and keep every measured card/row intact. */
export function paginatePdfBlocks(blocks: MeasuredPdfBlock[], capacity: number): PdfPageItem[][] {
  if (!Number.isFinite(capacity) || capacity <= 0) throw new Error('Invalid PDF content height');
  const byKey = new Map(blocks.map(block => [block.key, block]));
  if (blocks.some(block => !Number.isFinite(block.height) || block.height < 0 || block.height > capacity)) {
    throw new Error('A complete PDF block exceeds the content area');
  }
  const pages: PdfPageItem[][] = [];
  let page: PdfPageItem[] = [], used = 0;
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    let required = block.height;
    for (let next = index; blocks[next]?.keepNext && next + 1 < blocks.length; next++) {
      required += blocks[next + 1].height;
    }
    if (required > capacity) throw new Error('A heading and its content exceed one page');
    if (page.length && used + required > capacity) {
      pages.push(page); page = []; used = 0;
      const heading = block.continuationKey ? byKey.get(block.continuationKey) : undefined;
      if (heading) {
        const height = heading.continuationHeight ?? heading.height;
        if (!Number.isFinite(height) || height < 0 || height + required > capacity) {
          throw new Error('A continuation heading and its content exceed one page');
        }
        page.push({ keys: [heading.key], continuation: true }); used = height;
      }
    }
    const next = blocks[index + 1];
    if (block.pairWithNext && !block.keepNext && next?.pairWithNext && !next.keepNext
      && block.continuationKey === next.continuationKey && used + Math.max(block.height, next.height) <= capacity) {
      page.push({ keys: [block.key, next.key] });
      used += Math.max(block.height, next.height); index++;
    } else {
      page.push({ keys: [block.key] }); used += block.height;
    }
  }
  if (page.length) pages.push(page);
  return pages;
}
