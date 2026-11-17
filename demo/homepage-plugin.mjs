/**
 * Serves a copy of someone else's homepage at `/` only.
 * Root-relative URLs are rewritten to the live origin so CSS, images and
 * links keep working. Do not set <base href>: it would also retarget the
 * local widget module (`/src/main.tsx`) at the client's domain.
 *
 * @param {{ origin: string, badge: string }} options
 */

/**
 * The storefront catalog API has no CORS header. A demo hosted on another
 * origin cannot read a SKU's page URL from the browser. Look it up here and
 * only return a link on the store's own host.
 *
 * @param {string} origin
 * @param {string} skuId
 * @returns {Promise<string | null>}
 */
export async function lookupProductLink(origin, skuId) {
  if (!/^[0-9A-Za-z_-]{1,40}$/.test(skuId)) return null;
  const site = origin.replace(/\/$/, '');
  const response = await fetch(
    `${site}/api/catalog_system/pub/products/search?fq=skuId:${encodeURIComponent(skuId)}`,
    { headers: { accept: 'application/json' } },
  );
  if (!response.ok) return null;
  const products = await response.json();
  const link = Array.isArray(products) ? products[0]?.link : null;
  if (typeof link !== 'string' || !link.startsWith(`${site}/`)) return null;
  return link;
}

/**
 * Product cards for links the agent wrote as plain text
 * (`https://www.manole.com.br/<slug>/p`). Same no-CORS reason as above, so the
 * catalog is read here. Unknown slugs are left out.
 *
 * @param {string} origin
 * @param {string[]} slugs
 */
export async function lookupProductsBySlugs(origin, slugs) {
  const site = origin.replace(/\/$/, '');
  const valid = Array.from(new Set(slugs)).filter((slug) => /^[a-z0-9-]{1,200}$/.test(slug)).slice(0, 12);
  const rows = await Promise.all(
    valid.map(async (slug) => {
      try {
        const response = await fetch(`${site}/api/catalog_system/pub/products/search/${slug}/p`, {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) return null;
        const product = (await response.json())?.[0];
        const item = product?.items?.[0];
        if (!product || !item) return null;
        const seller = item.sellers?.find((s) => s.sellerDefault) ?? item.sellers?.[0];
        const offer = seller?.commertialOffer ?? {};
        return {
          slug,
          skuId: String(item.itemId),
          sellerId: seller?.sellerId ? String(seller.sellerId) : undefined,
          name: product.productName,
          link: typeof product.link === 'string' && product.link.startsWith(`${site}/`) ? product.link : `${site}/${slug}/p`,
          image: item.images?.[0]?.imageUrl,
          price: Number.isFinite(offer.Price) && offer.Price > 0 ? offer.Price : undefined,
          listPrice: Number.isFinite(offer.ListPrice) && offer.ListPrice > 0 ? offer.ListPrice : undefined,
        };
      } catch {
        return null;
      }
    }),
  );
  return rows.filter(Boolean);
}

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

/**
 * VTEX IO renders a different home for phones. Ask for the same class of
 * device the visitor is on, with a canonical UA (never the visitor's own).
 */
export function upstreamUserAgent(visitorUa) {
  return /Mobi|Android|iPhone|iPod/i.test(visitorUa || '') ? MOBILE_UA : DESKTOP_UA;
}

const DEV_SCRIPTS = `
<script type="module">
  import RefreshRuntime from '/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>
<script type="module" src="/src/main.tsx"></script>`;

/** Built bundle, used by the Vercel function. */
export const PROD_SCRIPTS = `<script type="module" src="/webchat.js"></script>`;

/**
 * Copy of the live homepage: root URLs pointed at the live origin, CSP meta
 * removed, demo badge, external links in a new tab, and the widget scripts.
 */
export function renderHomepage(source, site, badge, scripts) {
  let html = rewriteRootUrls(source, site);
  html = html.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
  // The live page also loads the store's installed panel (manole.webchat-assistant),
  // which would open on top of the demo's newer one. That app skips mounting
  // when its host already exists, so an empty placeholder keeps it out.
  html = html.replace(/<body([^>]*)>/i, '<body$1><div id="webchat-assistant-host" hidden></div>');
  const inject = `
<div class="wx-demo-badge">${escapeHtml(badge)}</div>
<style>
  .wx-demo-badge {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 2147483000;
    padding: 8px 12px;
    border-radius: 999px;
    background: #110982;
    color: #fff;
    font: 600 12px/1.2 "Maven Pro", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
    letter-spacing: 0.04em;
    pointer-events: none;
  }
</style>
<script>
  // The store's SPA router re-renders links as "/path" and would navigate
  // inside this copy. Catch clicks first (window, capture) and open the page
  // on the live site in a new tab, so this tab stays on the home.
  (function (site) {
    window.addEventListener('click', function (event) {
      var link = event.target && event.target.closest && event.target.closest('a[href]');
      if (!link || link.closest('.krc-assistant-root')) return;
      var href = link.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^(mailto|tel|javascript):/i.test(href)) return;
      var url = new URL(href, site + '/');
      if (url.origin === location.origin) url = new URL(url.pathname + url.search + url.hash, site);
      event.preventDefault();
      event.stopImmediatePropagation();
      if (url.href === site + '/') return;
      window.open(url.href, '_blank', 'noopener,noreferrer');
    }, true);
  })(${JSON.stringify(site)});
</script>${scripts}`;
  return html.includes('</body>') ? html.replace('</body>', `${inject}</body>`) : html + inject;
}

export function homepageDemoPlugin({ origin, badge }) {
  const site = origin.replace(/\/$/, '');

  return {
    name: 'homepage-demo',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '/').split('?')[0];
        if (req.method === 'GET' && path === '/api/products') {
          const slugs = (new URL(req.url || '/', 'http://localhost').searchParams.get('slugs') || '').split(',');
          const products = await lookupProductsBySlugs(site, slugs);
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify({ products }));
          return;
        }
        if (req.method === 'GET' && path === '/api/product-link') {
          const sku = new URL(req.url || '/', 'http://localhost').searchParams.get('sku') || '';
          try {
            const link = await lookupProductLink(site, sku);
            res.statusCode = link ? 200 : 404;
            res.setHeader('content-type', 'application/json');
            res.setHeader('cache-control', 'no-store');
            res.end(JSON.stringify(link ? { link } : { link: null }));
          } catch {
            res.statusCode = 502;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ link: null }));
          }
          return;
        }
        if (req.method !== 'GET' || (path !== '/' && path !== '/index.html')) return next();

        try {
          const response = await fetch(`${site}/`, {
            headers: {
              accept: 'text/html',
              'user-agent': upstreamUserAgent(req.headers['user-agent']),
            },
            redirect: 'follow',
          });
          if (!response.ok) {
            res.statusCode = 502;
            res.end(`A página inicial respondeu ${response.status}.`);
            return;
          }

          const html = renderHomepage(await response.text(), site, badge, DEV_SCRIPTS);
          res.statusCode = 200;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(html);
        } catch (error) {
          res.statusCode = 502;
          res.end(error instanceof Error ? error.message : 'Não foi possível copiar a página inicial.');
        }
      });
    },
  };
}

function rewriteRootUrls(html, site) {
  const attr = new RegExp(String.raw`(\s(?:href|src|action|poster)=)(["']?)(\/(?!\/))`, 'gi');
  html = html.replace(attr, `$1$2${site}$3`);
  html = html.replace(/(\ssrcset=)(["'])([\s\S]*?)\2/gi, (_, pre, quote, value) => {
    const rewritten = value.replace(/(^|,\s*)(\/(?!\/))/g, `$1${site}$2`);
    return `${pre}${quote}${rewritten}${quote}`;
  });
  html = html.replace(/url\((['"]?)(\/(?!\/))/gi, `url($1${site}$2`);
  return html;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
