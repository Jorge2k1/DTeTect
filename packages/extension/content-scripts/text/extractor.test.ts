import { describe, expect, it } from 'vitest';
import { extractVisibleText } from './extractor';

const LONG_PARAGRAPH =
  'Ayer volví al pueblo después de casi diez años y la casa de mis abuelos seguía en pie, ' +
  'aunque el tejado se había hundido un poco por el lado norte de la propiedad familiar.';

describe('extractVisibleText', () => {
  it('no duplica el texto cuando un párrafo está envuelto en article/section', () => {
    document.body.innerHTML = `
      <article>
        <h1>Título</h1>
        <p>${LONG_PARAGRAPH}</p>
      </article>
    `;

    const occurrences = extractVisibleText().split(LONG_PARAGRAPH).length - 1;
    expect(occurrences).toBe(1);
  });

  it('excluye contenido de nav, header, footer y aside', () => {
    document.body.innerHTML = `
      <nav><p>${LONG_PARAGRAPH} en la navegación.</p></nav>
      <article><p>${LONG_PARAGRAPH} en el artículo principal.</p></article>
      <footer><p>${LONG_PARAGRAPH} en el pie de página.</p></footer>
    `;

    const text = extractVisibleText();
    expect(text).toContain('en el artículo principal');
    expect(text).not.toContain('en la navegación');
    expect(text).not.toContain('en el pie de página');
  });

  it('descarta bloques con densidad de enlaces alta (menús de tarjetas)', () => {
    document.body.innerHTML = `
      <div>
        <p><a href="#">${LONG_PARAGRAPH}</a></p>
      </div>
    `;

    expect(extractVisibleText()).toBe('');
  });

  it('deduplica bloques con texto idéntico', () => {
    document.body.innerHTML = `
      <article>
        <p>${LONG_PARAGRAPH}</p>
        <section><p>${LONG_PARAGRAPH}</p></section>
      </article>
    `;

    const occurrences = extractVisibleText().split(LONG_PARAGRAPH).length - 1;
    expect(occurrences).toBe(1);
  });

  it('descarta bloques por debajo de la longitud mínima', () => {
    document.body.innerHTML = '<article><p>Muy corto.</p></article>';
    expect(extractVisibleText()).toBe('');
  });

  it('con skipVisibilityCheck, extrae texto de un documento sin layout (archivo subido)', () => {
    const doc = new DOMParser().parseFromString(`<article><p>${LONG_PARAGRAPH}</p></article>`, 'text/html');

    expect(extractVisibleText(doc)).toBe('');
    expect(extractVisibleText(doc, { skipVisibilityCheck: true })).toBe(LONG_PARAGRAPH);
  });

  it('con skipVisibilityCheck, sigue excluyendo nav/header/footer/aside y deduplicando', () => {
    const doc = new DOMParser().parseFromString(
      `<nav><p>${LONG_PARAGRAPH} en la navegación.</p></nav>
       <article><p>${LONG_PARAGRAPH}</p><section><p>${LONG_PARAGRAPH}</p></section></article>`,
      'text/html'
    );

    const occurrences = extractVisibleText(doc, { skipVisibilityCheck: true }).split(LONG_PARAGRAPH).length - 1;
    expect(occurrences).toBe(1);
  });
});
