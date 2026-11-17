import { lookupProductLink } from '../homepage-plugin.mjs';
import { ORIGIN } from '../demo.config.mjs';

export default async function handler(req, res) {
  const sku = typeof req.query.sku === 'string' ? req.query.sku : '';
  res.setHeader('cache-control', 'no-store');
  try {
    const link = await lookupProductLink(ORIGIN, sku);
    res.status(link ? 200 : 404).json({ link: link || null });
  } catch {
    res.status(502).json({ link: null });
  }
}
