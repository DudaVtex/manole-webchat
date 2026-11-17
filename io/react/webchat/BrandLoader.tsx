import React from 'react';

/**
 * Editora: um livro aberto folheando. Três páginas viram da direita para a
 * esquerda, uma depois da outra, e o ciclo recomeça com o livro igual ao
 * início. Cores vêm dos tokens; `prefers-reduced-motion` zera a animação.
 */
export default function BrandLoader() {
  return (
    <svg className="krc-loader" width="160" height="48" viewBox="0 0 160 48" aria-hidden="true">
      <path className="krc-loader-cover" d="M80 40 C70 35 58 35 46 38 V12 C58 9 70 9 80 14 C90 9 102 9 114 12 V38 C102 35 90 35 80 40 Z" />
      <line className="krc-loader-spine" x1="80" y1="14" x2="80" y2="40" />
      <path className="krc-loader-page krc-loader-page--1" d="M80 14 C90 10 100 10 110 13 V36 C100 33 90 33 80 37 Z" />
      <path className="krc-loader-page krc-loader-page--2" d="M80 14 C90 10 100 10 110 13 V36 C100 33 90 33 80 37 Z" />
      <path className="krc-loader-page krc-loader-page--3" d="M80 14 C90 10 100 10 110 13 V36 C100 33 90 33 80 37 Z" />
    </svg>
  );
}
