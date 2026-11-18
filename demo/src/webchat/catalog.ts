// Where product data comes from.
//
// `store`: inside the VTEX IO store (the pixel app). The catalog API is on the
//          same origin, so the browser reads it directly.
// `proxy`: the Vercel demo. The store's catalog sends no CORS header, so the
//          demo's own server reads it (`/api/products`, `/api/product-link`).

export type CatalogMode = 'store' | 'proxy';

let mode: CatalogMode = 'proxy';

export function setCatalogMode(next: CatalogMode | undefined) {
  mode = next === 'store' ? 'store' : 'proxy';
}

export function catalogMode(): CatalogMode {
  return mode;
}

export interface CatalogRow {
  slug: string;
  skuId: string;
  sellerId?: string;
  name: string;
  link: string;
  image?: string;
  price?: number;
  listPrice?: number;
}

function toRow(slug: string, product: any): CatalogRow | null {
  const item = product?.items?.[0];
  if (!product || !item) return null;
  const seller = item.sellers?.find((s: any) => s.sellerDefault) ?? item.sellers?.[0];
  const offer = seller?.commertialOffer ?? {};
  return {
    slug,
    skuId: String(item.itemId),
    sellerId: seller?.sellerId ? String(seller.sellerId) : undefined,
    name: product.productName,
    link: typeof product.link === 'string' ? product.link : `/${slug}/p`,
    image: item.images?.[0]?.imageUrl,
    price: Number.isFinite(offer.Price) && offer.Price > 0 ? offer.Price : undefined,
    listPrice: Number.isFinite(offer.ListPrice) && offer.ListPrice > 0 ? offer.ListPrice : undefined,
  };
}

async function searchJson(path: string): Promise<any[]> {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/** Product rows for PDP slugs. Unknown slugs are left out. */
export async function productsBySlugs(slugs: string[]): Promise<CatalogRow[]> {
  const valid = slugs.filter((slug) => /^[a-z0-9-]{1,200}$/.test(slug)).slice(0, 12);
  if (!valid.length) return [];
  try {
    if (mode === 'proxy') {
      const response = await fetch(`/api/products?slugs=${encodeURIComponent(valid.join(','))}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { products?: CatalogRow[] };
      return data.products ?? [];
    }
    const rows = await Promise.all(
      valid.map((slug) =>
        searchJson(`/api/catalog_system/pub/products/search/${slug}/p`)
          .then((products) => toRow(slug, products[0]))
          .catch(() => null),
      ),
    );
    return rows.filter((row): row is CatalogRow => row !== null);
  } catch {
    return [];
  }
}

/** The PDP URL of a SKU, when a message didn't carry `product_url`. */
export async function productLinkForSku(skuId: string): Promise<string | null> {
  try {
    if (mode === 'proxy') {
      const response = await fetch(`/api/product-link?sku=${encodeURIComponent(skuId)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;
      const { link } = (await response.json()) as { link?: string | null };
      return typeof link === 'string' && link ? link : null;
    }
    const products = await searchJson(`/api/catalog_system/pub/products/search?fq=skuId:${encodeURIComponent(skuId)}`);
    const link = products[0]?.link;
    return typeof link === 'string' && link ? link : null;
  } catch {
    return null;
  }
}
