import { lookupProductsBySlugs } from '../homepage-plugin.mjs';
import { ORIGIN } from '../demo.config.mjs';

export default async function handler(req, res) {
  const slugs = typeof req.query.slugs === 'string' ? req.query.slugs.split(',') : [];
  try {
    const products = await lookupProductsBySlugs(ORIGIN, slugs);
    res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ products });
  } catch {
    res.status(502).json({ products: [] });
  }
}
