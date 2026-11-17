// Follow-up suggestions shown under a product carousel.
//
// Built on the client from what the carousel actually carried - the product
// names - so they always fit the products on screen. Nothing about price: a
// "cheaper than X" button promises products the catalog may not have. Each
// label is also the message that gets sent, so the agent receives plain,
// specific text.
import type { ChatProduct } from './mapMessage';

const MAX_SUGGESTIONS = 4;

type Format = 'curso' | 'combo' | 'livro';

const FORMATS: Array<{ pattern: RegExp; key: Format; plural: string }> = [
  { pattern: /^(curso online|curso de atualizacao|summit|congresso|jornada)/, key: 'curso', plural: 'cursos' },
  { pattern: /^(curso|treinamento) (atendimento|avancado|pratico|de prescricao|de medicina)/, key: 'curso', plural: 'cursos' },
  { pattern: /^combo|^kit|^colecao/, key: 'combo', plural: 'combos' },
];

// Areas the home's menu links to (/livros/livros-de-*, /e-books/e-books-de-*).
const AREAS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /emergencia|pre-hospitalar|plantao|paciente critico/, label: 'medicina de emergência' },
  { pattern: /enfermagem/, label: 'enfermagem' },
  { pattern: /direito|constitucional|juridic/, label: 'direito' },
  { pattern: /nutricao|carboidrato|alimento/, label: 'nutrição' },
  { pattern: /psicolog|psiquiatr|comportamento/, label: 'psicologia' },
  { pattern: /odontolog/, label: 'odontologia' },
  { pattern: /fisioterap/, label: 'fisioterapia' },
  { pattern: /fonoaudiolog/, label: 'fonoaudiologia' },
  { pattern: /cardiolog/, label: 'cardiologia' },
  { pattern: /farmac|dose/, label: 'farmácia' },
  { pattern: /gastronomia|culinaria/, label: 'gastronomia' },
  { pattern: /administra|gestao/, label: 'administração' },
];

function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function formatOf(name: string): Format {
  const clean = normalise(name);
  return FORMATS.find((f) => f.pattern.test(clean))?.key ?? 'livro';
}

/** The value most of the carousel shares, if one stands out. */
function dominant<T>(values: Array<T | null>): T | null {
  const counts = new Map<T, number>();
  for (const value of values) if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: [T, number] | null = null;
  for (const entry of Array.from(counts.entries())) if (!best || entry[1] > best[1]) best = entry;
  return best && best[1] * 2 >= values.length ? best[0] : null;
}

function areaOf(name: string): string | null {
  const clean = normalise(name);
  return AREAS.find((a) => a.pattern.test(clean))?.label ?? null;
}

export function suggestFollowUps(products: ChatProduct[]): string[] {
  if (!products.length) return [];
  const suggestions: string[] = [];
  const format = dominant(products.map((p) => formatOf(p.name))) ?? 'livro';
  const area = dominant(products.map((p) => areaOf(p.name)));
  const plural = FORMATS.find((f) => f.key === format)?.plural ?? 'livros';

  suggestions.push(area ? `Mais ${plural} de ${area}` : `Mais ${plural}`);

  if (format === 'livro') {
    suggestions.push('Esses títulos têm versão em e-book?');
    if (area) suggestions.push(`Cursos de ${area}`);
  } else if (area) {
    suggestions.push(`Livros de ${area}`);
  }

  if (products.length >= 2) suggestions.push('Qual desses é mais indicado para começar?');

  return suggestions.slice(0, MAX_SUGGESTIONS);
}
