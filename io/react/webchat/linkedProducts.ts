// The agent sometimes answers a product search in prose — one line per title
// with its PDP link and price — instead of a `catalog_message`. Same question,
// same channel, either shape (measured on the live channel). This turns those
// lines back into product cards, so the shopper always gets the carousel.
import { useEffect, useMemo, useState } from 'react';
import type { ChatProduct } from './mapMessage';
import { productsBySlugs, CatalogRow } from './catalog';

const cache = new Map<string, Promise<CatalogRow | null>>();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pdpPattern(storeOrigin: string): RegExp {
  const host = new URL(storeOrigin).host.replace(/^www\./, '');
  return new RegExp(String.raw`https?://(?:www\.)?${escapeRegExp(host)}/([a-z0-9-]+)/p(?:[?#][^\s)\]|>]*)?`, 'gi');
}

/** "R$ 1.302,10" -> 1302.1 */
function priceIn(line: string): number | undefined {
  const match = line.match(/R\$\s?([\d.]+,\d{2})/);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

interface LinkedLine {
  slug: string;
  url: string;
  price?: number;
}

/** Blocks separated by a blank line: one product per block is the usual shape. */
function paragraphs(text: string): string[][] {
  return text.split(/\n\s*\n/).map((block) => block.split('\n'));
}

function slugsIn(line: string, storeOrigin: string): RegExpMatchArray[] {
  return Array.from(line.matchAll(pdpPattern(storeOrigin)));
}

/**
 * Each PDP link in the text, in order, with the price written for it: on its
 * own line, or anywhere in its block when the block holds only that link.
 */
export function findProductLinks(text: string, storeOrigin: string): LinkedLine[] {
  const found: LinkedLine[] = [];
  const seen = new Set<string>();
  for (const block of paragraphs(text)) {
    const blockLinks = block.flatMap((line) => slugsIn(line, storeOrigin));
    const single = new Set(blockLinks.map((m) => m[1].toLowerCase())).size === 1;
    for (const line of block) {
      for (const match of slugsIn(line, storeOrigin)) {
        const slug = match[1].toLowerCase();
        if (seen.has(slug)) continue;
        seen.add(slug);
        found.push({ slug, url: match[0], price: priceIn(line) ?? (single ? priceIn(block.join('\n')) : undefined) });
      }
    }
  }
  return found;
}

/** Only a link, maybe with bullets, a label ("Link:"), separators or a price. */
function isBareLinkLine(line: string, storeOrigin: string): boolean {
  return !line
    .replace(pdpPattern(storeOrigin), '')
    .replace(/R\$\s?[\d.]+,\d{2}/g, '')
    .replace(/\b(link|url|acesse|veja|ver|compre|aqui|pre[cç]o|valor|por)\b/gi, '')
    .replace(/[\s|—–\-•*:()[\]<>🔗👉]/gu, '');
}

/** The text without the lines the cards now show. */
export function stripProductLines(text: string, slugs: Set<string>, storeOrigin: string): string {
  const kept = paragraphs(text).map((block) => {
    const links = block.flatMap((line) => slugsIn(line, storeOrigin)).map((m) => m[1].toLowerCase());
    if (!links.length || !links.every((slug) => slugs.has(slug))) return block;
    // One product per block: the whole block is that product (title, link,
    // price, format). An intro line ending in ":" stays.
    if (new Set(links).size === 1) return /:\s*$/.test(block[0]) && !slugsIn(block[0], storeOrigin).length ? [block[0]] : [];
    // Several products in one block: drop each link line, and the title line
    // above a link that sits alone on its line.
    const drop = new Set<number>();
    block.forEach((line, index) => {
      if (!slugsIn(line, storeOrigin).length) return;
      drop.add(index);
      if (isBareLinkLine(line, storeOrigin) && index > 0 && !drop.has(index - 1) && !/[:?!]\s*$/.test(block[index - 1])) {
        drop.add(index - 1);
      }
    });
    return block.filter((_, index) => !drop.has(index));
  });
  return kept
    .filter((block) => block.some((line) => line.trim()))
    .map((block) => block.join('\n'))
    .join('\n\n')
    .trim();
}

function fetchRows(slugs: string[]): Promise<Array<CatalogRow | null>> {
  const missing = slugs.filter((slug) => !cache.has(slug));
  if (missing.length) {
    const batch = productsBySlugs(missing);
    for (const slug of missing) cache.set(slug, batch.then((rows) => rows.find((row) => row.slug === slug) ?? null));
  }
  return Promise.all(slugs.map((slug) => cache.get(slug)!));
}

function toProduct(row: CatalogRow, line: LinkedLine): ChatProduct {
  // The agent's line carries the price the shopper is charged (promotions
  // included); the public catalog only knows the list price.
  const price = line.price ?? row.price;
  const reference = Math.max(row.listPrice ?? 0, row.price ?? 0);
  return {
    key: row.sellerId ? `${row.skuId}#${row.sellerId}` : row.skuId,
    name: row.name,
    price,
    listPrice: price !== undefined && reference > price ? reference : undefined,
    image: row.image,
    url: line.url,
    sellerId: row.sellerId,
  };
}

/**
 * Cards for the PDP links in an agent message that carried no products.
 * `null` until there is at least one card to show; the text stays as sent.
 */
export function useLinkedProducts(
  text: string,
  storeOrigin: string | undefined,
  enabled: boolean,
): { products: ChatProduct[]; text: string } | null {
  const links = useMemo(
    () => (enabled && storeOrigin && text ? findProductLinks(text, storeOrigin) : []),
    [enabled, storeOrigin, text],
  );
  const key = links.map((link) => link.slug).join(',');
  const [rows, setRows] = useState<{ key: string; rows: Array<CatalogRow | null> } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    // A streamed reply grows a few characters at a time: wait for it to settle.
    const timer = window.setTimeout(() => {
      fetchRows(key.split(',')).then((result) => {
        if (alive) setRows({ key, rows: result });
      });
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [key]);

  return useMemo(() => {
    if (!key || !storeOrigin || rows?.key !== key) return null;
    const products: ChatProduct[] = [];
    const shown = new Set<string>();
    links.forEach((link, index) => {
      const row = rows.rows[index];
      if (!row) return;
      products.push(toProduct(row, link));
      shown.add(link.slug);
    });
    if (!products.length) return null;
    return { products, text: stripProductLines(text, shown, storeOrigin) };
  }, [key, links, rows, storeOrigin, text]);
}
