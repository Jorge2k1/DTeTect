import { extractVisibleText } from '../content-scripts/extractor';

export const SUPPORTED_FILE_EXTENSIONS = ['.txt', '.md', '.markdown', '.html', '.htm', '.docx', '.pdf'];

export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

async function readPlainText(file: File): Promise<string> {
  return file.text();
}

async function readHtmlFile(file: File): Promise<string> {
  const raw = await file.text();
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  return extractVisibleText(doc, { skipVisibilityCheck: true });
}

/**
 * mammoth y pdfjs-dist se cargan con import() dinámico, no en el top-level:
 * juntos pesan más de 1MB, y la mayoría de sesiones del side panel nunca
 * tocan la pestaña de archivo. Así solo se descargan (y Vite los separa en
 * su propio chunk) la primera vez que hace falta cada uno.
 */
async function readDocxFile(file: File): Promise<string> {
  const { default: mammoth } = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}

let pdfWorkerConfigured = false;

async function readPdfFile(file: File): Promise<string> {
  const [pdfjsLib, { default: pdfWorkerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    // El worker se referencia como URL de asset para que Vite lo empaquete
    // y copie al dist de la extensión — pdf.js no puede parsear en el hilo
    // principal sin él.
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);

  if (!pdfWorkerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    pdfWorkerConfigured = true;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pageTexts.push(pageText);
  }

  return pageTexts.join('\n\n');
}

/**
 * Lanza si la extensión no está soportada — el llamador decide cómo
 * comunicarlo (mismo patrón que el resto de señales: fallar de forma
 * explícita en vez de devolver silenciosamente texto vacío o basura).
 */
export async function readFileAsText(file: File): Promise<string> {
  const extension = getExtension(file.name);

  switch (extension) {
    case '.txt':
    case '.md':
    case '.markdown':
      return readPlainText(file);
    case '.html':
    case '.htm':
      return readHtmlFile(file);
    case '.docx':
      return readDocxFile(file);
    case '.pdf':
      return readPdfFile(file);
    default:
      throw new Error(`Formato no soportado: ${extension || 'sin extensión'}`);
  }
}
