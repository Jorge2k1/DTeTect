import { describe, expect, it } from 'vitest';
import { getExtension, readFileAsText, SUPPORTED_FILE_EXTENSIONS } from './file-readers';

function makeFile(name: string, content: string, type = 'text/plain'): File {
  return new File([content], name, { type });
}

describe('getExtension', () => {
  it('extrae la extensión en minúsculas', () => {
    expect(getExtension('Informe.PDF')).toBe('.pdf');
    expect(getExtension('notas.md')).toBe('.md');
  });

  it('devuelve cadena vacía si no hay extensión', () => {
    expect(getExtension('README')).toBe('');
  });
});

describe('readFileAsText', () => {
  it('lee archivos .txt y .md como texto plano', async () => {
    const txt = await readFileAsText(makeFile('nota.txt', 'Texto de prueba.'));
    expect(txt).toBe('Texto de prueba.');

    const md = await readFileAsText(makeFile('nota.md', '# Título\n\nContenido en markdown.'));
    expect(md).toContain('Contenido en markdown.');
  });

  it('extrae el texto visible de un archivo .html reutilizando el extractor', async () => {
    const html = makeFile(
      'pagina.html',
      `<html><body>
        <nav><a href="#">Inicio</a></nav>
        <article><p>Este es el contenido principal del artículo subido como archivo HTML.</p></article>
      </body></html>`,
      'text/html'
    );

    const text = await readFileAsText(html);
    expect(text).toContain('contenido principal del artículo');
    expect(text).not.toContain('Inicio');
  });

  it('rechaza extensiones no soportadas con un error explícito', async () => {
    await expect(readFileAsText(makeFile('archivo.xyz', 'contenido'))).rejects.toThrow(/no soportado/i);
  });

  it('SUPPORTED_FILE_EXTENSIONS incluye los formatos anunciados en la UI', () => {
    expect(SUPPORTED_FILE_EXTENSIONS).toEqual(['.txt', '.md', '.markdown', '.html', '.htm', '.docx', '.pdf']);
  });
});
