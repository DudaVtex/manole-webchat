// Back-in-stock sign-up ("Avise-me quando voltar ao estoque").
//
// The rules (is the selected SKU out of stock, which seller, phone validation)
// and the request come from @weni/webchat-service >= 1.21.0, as the VTEX CX
// guide asks. This file only gathers the page data the service doesn't read:
// the product in catalog format, the selected SKU, sales channel and locale.
//
// The subscription goes to /_v/private/availability-notify/subscribe on the
// store's own domain with the shopper's vtex_session cookie (vtex.agentic-cx).
// On the Vercel demo (catalog via proxy) that route and cookie don't exist, so
// it runs the same validation and answers as if the store had accepted.

import { catalogMode } from './catalog';

export interface BackInStockOffer {
  skuId: string;
  seller: string;
  productName: string;
}

export interface ContactErrors {
  name?: 'required';
  phone?: 'invalid';
}

export type SubscribeResult =
  | { ok: true; accepted: boolean }
  | { ok: false; errors?: ContactErrors };

interface ServiceLike {
  evaluateBackInStockOffer(input: { product: unknown; selectedSkuId: string }): {
    isUnavailable: boolean;
    skuId: string;
    seller: string;
  };
  validateBackInStockContact(input: { name: string; phone: string }): { isValid: boolean; errors: ContactErrors };
  subscribeBackInStock(input: {
    name: string;
    phone: string;
    skuId: string;
    seller: string;
    salesChannel: string | null;
    storeLocales: string[];
    language: string;
  }): Promise<{ accepted: boolean }>;
}

let servicePromise: Promise<ServiceLike> | null = null;

/** Loaded only on a product page with the feature on: the library brings a phone-number database. */
function loadService(socketUrl: string, channelUuid: string): Promise<ServiceLike> {
  if (!servicePromise) {
    servicePromise = import('@weni/webchat-service').then((mod: any) => {
      const Service = mod.default ?? mod;
      return new Service({
        socketUrl,
        channelUuid,
        host: 'https://flows.weni.ai',
        backInStock: { timeoutMs: 10000, maxRetries: 2, retryBaseDelayMs: 500 },
      }) as ServiceLike;
    });
    servicePromise.catch(() => {
      servicePromise = null;
    });
  }
  return servicePromise;
}

/** The product exactly as the catalog API returns it (the service reads `commertialOffer`). */
async function fetchProduct(linkText: string): Promise<any | null> {
  const url =
    catalogMode() === 'store'
      ? `/api/catalog_system/pub/products/search/${encodeURIComponent(linkText)}/p`
      : `/api/product?slug=${encodeURIComponent(linkText)}`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = await response.json();
    const list = Array.isArray(data) ? data : [data];
    return list.find((product: any) => product?.linkText === linkText) ?? null;
  } catch {
    return null;
  }
}

function selectedSkuId(product: any): string {
  const fromUrl = new URLSearchParams(window.location.search).get('skuId');
  if (fromUrl) return fromUrl;
  return product?.items?.[0]?.itemId ? String(product.items[0].itemId) : '';
}

/** The offer for this product page, or null when the selected SKU can be bought. */
export async function evaluateOffer(
  linkText: string,
  channel: { socketUrl: string; channelUuid: string },
): Promise<BackInStockOffer | null> {
  const [service, product] = await Promise.all([loadService(channel.socketUrl, channel.channelUuid), fetchProduct(linkText)]);
  if (!product) return null;
  const offer = service.evaluateBackInStockOffer({ product, selectedSkuId: selectedSkuId(product) });
  if (!offer.isUnavailable) return null;
  return { skuId: offer.skuId, seller: offer.seller, productName: String(product.productName || '') };
}

function readChannelValue(channel: unknown): string | null {
  if (channel == null || channel === '') return null;
  try {
    const parsed = JSON.parse(String(channel));
    if (parsed?.salesChannel) return String(parsed.salesChannel);
  } catch {
    /* plain value */
  }
  return String(channel);
}

function salesChannel(): string | null {
  const w = window as any;
  try {
    const session = w.faststore_sdk_stores?.get('fs::session')?.read?.();
    const channel = readChannelValue(session?.channel);
    if (channel) return channel;
  } catch {
    /* not FastStore */
  }
  try {
    const token = w.__RUNTIME__?.segmentToken;
    if (token) return readChannelValue(JSON.parse(atob(token))?.channel);
  } catch {
    /* no segment token */
  }
  return null;
}

function storeLocales(): string[] {
  const w = window as any;
  return [w.__RUNTIME__?.culture?.locale, document.documentElement.lang].filter(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
}

export async function subscribe(
  offer: BackInStockOffer,
  contact: { name: string; phone: string },
  options: { socketUrl: string; channelUuid: string },
): Promise<SubscribeResult> {
  const service = await loadService(options.socketUrl, options.channelUuid);
  const check = service.validateBackInStockContact(contact);
  if (!check.isValid) return { ok: false, errors: check.errors };

  if (catalogMode() !== 'store') {
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    return { ok: true, accepted: true };
  }

  try {
    const { accepted } = await service.subscribeBackInStock({
      ...contact,
      skuId: offer.skuId,
      seller: offer.seller,
      salesChannel: salesChannel(),
      storeLocales: storeLocales(),
      language: 'pt-BR',
    });
    return { ok: true, accepted };
  } catch (error: any) {
    if (error?.code === 'VALIDATION') return { ok: false, errors: error.fields };
    return { ok: false };
  }
}
