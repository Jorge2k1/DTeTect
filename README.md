# Pimienta
pepper
pan de pipillas

## Evidence Aggregation System (Fase 1 — texto)

Extensión de navegador (Edge, Manifest V3) que analiza el texto visible de la
pestaña activa y calcula un **score de confianza explicado**, combinando
varias señales de evidencia de fiabilidad distinta. No es un detector
binario "esto es IA / esto es humano" — el objetivo es dar soporte
justificable (due diligence, Artículo 50 del EU AI Act) sin prometer una
certeza que ningún detector actual puede ofrecer.

Todo el análisis de texto corre 100% en el cliente, sin backend: nada del
contenido de la pestaña sale del navegador del usuario.

### Arquitectura

Monorepo con dos paquetes, separando lógica pura de la integración con el
navegador para que V2 (evidencia de imagen: C2PA, EXIF) se pueda sumar sin
reescribir nada:

```
/packages
  /core        TypeScript puro, sin DOM ni chrome.*, testeable con vitest
    /signals
      types.ts                    Evidence genérico (misma forma para texto e imagen)
      /text
        tokenize.ts                Split de frases/palabras compartido
        burstiness.ts              Variación de longitud de frase (coef. de variación)
        mattr.ts                   Riqueza léxica (Moving-Average TTR)
        ngram-repetition.ts        Repetición de trigramas
        perplexity.ts              Stub: interfaz lista, pendiente de modelo ONNX
    /fusion
      fusion-engine.ts             Combina Evidence[] en score + nivel de confianza
    /explainability
      explain.ts                   Rankea evidencia por impacto, genera resumen
    calibration.test.ts            Tests de regresión contra textos de referencia reales

  /extension   Manifest V3
    manifest.json
    /content-scripts
      extractor.ts                 Extracción de texto tipo Readability (sin chrome.*, testeable)
      dom-observer.ts              MutationObserver para SPA/contenido dinámico
      content-script.ts            Entry point: cablea extractor + observer con chrome.runtime
    /background
      service-worker.ts            Habilita el side panel al hacer clic
    /sidepanel
      index.html / sidepanel.ts / sidepanel.css   UI: score + evidencias explicadas

/test-pages    Páginas HTML locales para probar la extensión sin depender de internet
```

### Qué está implementado (Fase 1)

- **3 señales de texto reales y calibradas**: burstiness, MATTR y repetición
  de n-gramas. Cada una tiene tests unitarios y está validada contra 5 textos
  de referencia reales (no inventados): un blog personal de 2010, un relato
  narrativo, dos textos con patrón de IA (uno repetitivo, otro técnico sin
  repetición literal) y la página "Company" de anthropic.com.
- **Fusion Engine**: combina `Evidence[]` genérico en un score ponderado (no
  promedio simple) — pesa por confianza de cada evidencia individual y por
  un peso configurable por tipo de señal. Ya tiene reservados los pesos para
  `c2pa-provenance` y `exif-metadata` de V2.
- **Explainability**: ordena evidencias por impacto real en el score y genera
  un resumen legible.
- **Extractor de contenido**: extracción tipo Readability (filtra
  nav/header/footer/aside, descarta bloques de alta densidad de enlaces,
  deduplica bloques contenedores vs. sus hijos) + `MutationObserver` con
  debounce para contenido dinámico.
- **Side panel**: analiza la pestaña activa, se reanaliza al cambiar de
  pestaña o al recargar, muestra score + evidencias explicadas.
- **Perplexity sigue siendo un stub** (interfaz lista, confianza 0). Se
  intentó un proxy sin modelo pre-entrenado (bigramas entrenados en la
  mitad del texto, evaluados en la otra mitad) pero se descartó: un
  documento de unos cientos de palabras no tiene datos suficientes para que
  un bigrama generalice, y daba lecturas confiadas y equivocadas en texto
  realista. La perplexity fiable requiere un modelo real (ONNX Runtime Web +
  algo tipo distilgpt2) — próximo paso.

### Limitación conocida (importante, no es un bug)

Las 3 señales actuales detectan bien la IA **cruda y repetitiva** (vocabulario
pobre, frases uniformes), pero **no pueden distinguir escritura pulida**,
sea humana o de IA: burstiness, MATTR y n-gramas miden torpeza de estilo, no
autoría. Un texto bien editado — por un humano o por una IA bien instruida —
comparte el mismo perfil estadístico (frases variadas, vocabulario amplio,
poca repetición literal). Subir la sensibilidad de estas señales para
detectar IA pulida generaría falsos positivos en escritura humana igual de
pulida. Esto no se resuelve con más calibración de estas 3 señales; requiere
una señal basada en un modelo de lenguaje real (perplexity vía ONNX) o
evidencia dura (C2PA/EXIF, V2).

### Desarrollo

```bash
npm install
npm test              # vitest en core + extension
npm run typecheck
npm run build:extension   # genera packages/extension/dist
```

Para probar la extensión: `edge://extensions` → activar "Modo de
desarrollador" → "Cargar descomprimida" → seleccionar
`packages/extension/dist`. Las páginas en `test-pages/` sirven para probar
sin depender de un sitio real (requiere activar "Permitir acceso a las URL
de archivo" en los detalles de la extensión).

### Próximos pasos (Fase 1)

1. Implementar perplexity real vía ONNX Runtime Web (modelo pequeño tipo
   distilgpt2), sustituyendo el stub sin tocar el Fusion Engine ni la UI.
   Aparcado de momento: se probó en local (ver Capítulo 3) y no resuelve el
   problema que se buscaba resolver.
2. V2: señales de imagen (C2PA, Content Credentials, EXIF) sumándose al
   mismo `Evidence[]` y a la misma UI.

---

## Capítulo 2 — Side panel: pestañas, desglose por señal y subida de archivos

Extiende la Fase 1 sin tocar el core: **no se creó ninguna señal ni lógica
de detección nueva**. Todo lo de este capítulo es UI y extracción de texto
en el host (`packages/extension`). El pipeline de análisis —
`burstinessSignal` + `mattrSignal` + `ngramRepetitionSignal` +
`stubPerplexitySignal` → `fuse()` → `explain()` — es exactamente el mismo
del Capítulo 1 (función `collectEvidence`, sin cambios), y ahora lo
comparten dos flujos de entrada distintos en vez de uno.

### Dos pestañas en el side panel

- **Página actual**: el flujo de siempre (pestaña activa → content script →
  `extractVisibleText`).
- **Analizar archivo**: arrastra o selecciona un archivo propio
  (`.txt`, `.md`, `.html`, `.docx`, `.pdf`) y se analiza con el mismo
  pipeline. Pensado para el caso "quiero comprobar MI documento", ya que no
  se puede confiar en extraer bien el contenido de cualquier web.

Cada pestaña tiene su propio bloque de resultado (`#dom-*` / `#file-*` en
el HTML) para no perder el resultado de una al mirar la otra; ambas
reutilizan las mismas funciones de renderizado (`renderResult`,
`renderLoading`, `renderEmpty`) parametrizadas por qué elementos pintar.

### Desglose por señal

Cada evidencia en la UI ahora muestra, además del texto explicativo:
contribución en % con dirección ("43% hacia IA"), una barra visual
centrada en 0, la confianza de esa señal concreta y su peso final en el
resultado. Es el mismo dato que `fuse()`/`explain()` ya calculaban — antes
no se mostraba desglosado, ahora sí.

### Lectores de archivo (`packages/extension/sidepanel/file-readers.ts`)

- `.txt` / `.md` / `.markdown`: texto plano tal cual.
- `.html` / `.htm`: se parsea con `DOMParser` y se reutiliza el **mismo**
  `extractVisibleText` del content script — no hay una segunda
  implementación de extracción. Un documento de `DOMParser` no está
  insertado en la página, así que no tiene layout real; se añadió una
  opción `skipVisibilityCheck` a `extractVisibleText` para ese caso
  concreto (los filtros de exclusión de nav/header/footer, densidad de
  enlaces y longitud mínima se siguen aplicando igual).
- `.docx`: vía `mammoth` (dependencia nueva).
- `.pdf`: vía `pdfjs-dist`, la librería oficial de PDF.js (dependencia
  nueva).
- `mammoth` y `pdfjs-dist` se cargan con `import()` dinámico, no al abrir
  el side panel: juntos pesan más de 1MB y la mayoría de sesiones no tocan
  esa pestaña. El bundle inicial del side panel se queda en ~11KB; cada
  lector se descarga solo la primera vez que hace falta.

### Qué NO cambió en este capítulo

- `packages/core` no se tocó: mismas señales, mismos pesos, mismo Fusion
  Engine que en el Capítulo 1.
- No existe una segunda extracción de texto para HTML: se extendió
  `extractVisibleText` con una opción, no se duplicó la lógica.

---

## Capítulo 3 — Intento de perplexity real (ONNX), aparcado

Se probó, en local (no integrado en la extensión), `@huggingface/transformers`
+ `Xenova/distilgpt2` para calcular perplexity real (cross-entropy sobre los
logits del modelo, no un proxy). Funcionó técnicamente — el modelo se
descarga y ejecuta bien — pero al medirlo contra los textos de referencia
dio el mismo problema que MATTR: la perplexity de un modelo pequeño
depende mucho del género/registro del texto (técnico vs. narrativo), no
solo de si lo escribió una IA. El texto de la página "Company" de
anthropic.com dio una perplexity casi idéntica a un blog humano casual
(47 vs. 42), y un texto técnico de IA dio la perplexity *más alta* de
todas (81) — el modelo lo leía como "el menos predecible", al revés de lo
esperado. No se integró en la extensión: el código no llegó a tocar
`packages/core` ni `packages/extension`.
