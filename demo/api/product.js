import { lookupRawProduct } from '../homepage-plugin.mjs';
import { ORIGIN } from '../demo.config.mjs';

export default async function handler(req, res) {
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  try {
    const product = await lookupRawProduct(ORIGIN, slug);
    res.setHeader('cache-control', 's-maxage=60, stale-while-revalidate=300');
    res.status(product ? 200 : 404).json(product);
  } catch {
    res.status(502).json(null);
  }
}
