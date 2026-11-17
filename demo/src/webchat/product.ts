// Where a product card leads when the payload carried no `product_url`.
import { productLinkForSku } from './catalog';

/** The PDP for a SKU. A SKU the catalog doesn't index has no URL. */
export async function resolveProductUrl(skuId: string): Promise<string | null> {
  const link = await productLinkForSku(skuId);
  return link ? `${link}?skuId=${encodeURIComponent(skuId)}` : null;
}
