import { renderHomepage, PROD_SCRIPTS, upstreamUserAgent } from '../homepage-plugin.mjs';
import { ORIGIN, BADGE } from '../demo.config.mjs';

export default async function handler(req, res) {
  const site = ORIGIN.replace(/\/$/, '');
  try {
    const response = await fetch(`${site}/`, {
      headers: { accept: 'text/html', 'user-agent': upstreamUserAgent(req.headers['user-agent']) },
      redirect: 'follow',
    });
    if (!response.ok) {
      res.status(502).send(`A página inicial respondeu ${response.status}.`);
      return;
    }
    const html = renderHomepage(await response.text(), site, BADGE, PROD_SCRIPTS);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    // Phone and desktop get different markup: never share one cached copy.
    res.setHeader('cache-control', 'no-store');
    res.status(200).send(html);
  } catch (error) {
    res.status(502).send(error instanceof Error ? error.message : 'Não foi possível copiar a página inicial.');
  }
}
