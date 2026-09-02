# Pimienta
pepper
pan de pipillas

### Índice

- [Capítulo 0 — Instalar la extensión (primera vez)](#capítulo-0--instalar-la-extensión-primera-vez)
- [Capítulo 1 — Evidence Aggregation System (Fase 1 — texto)](#capítulo-1--evidence-aggregation-system-fase-1--texto)
- [Capítulo 2 — Side panel: pestañas, desglose por señal y subida de archivos](#capítulo-2--side-panel-pestañas-desglose-por-señal-y-subida-de-archivos)
- [Capítulo 3 — Intento de perplexity real (ONNX), aparcado](#capítulo-3--intento-de-perplexity-real-onnx-aparcado)
- [Capítulo 4 — Fase 2: señales de imagen (EXIF + C2PA)](#capítulo-4--fase-2-señales-de-imagen-exif--c2pa)
- [Capítulo 5 — Señales de imagen adicionales: XMP, URL y contexto de página](#capítulo-5--señales-de-imagen-adicionales-xmp-url-y-contexto-de-página)
- [Capítulo 6 — UI: qué atributo concreto detectó cada evidencia](#capítulo-6--ui-qué-atributo-concreto-detectó-cada-evidencia)

---

## Capítulo 0 — Instalar la extensión (primera vez)

Guía pensada para alguien que no ha hecho esto antes. Se hace una sola vez;
si el código cambia más adelante, solo hace falta repetir el paso 4 y
recargar en el navegador (paso 6).

### 1. Instalar Node.js (si no lo tienes)

Descarga e instala la versión **LTS** desde [nodejs.org](https://nodejs.org).
Para comprobar si ya lo tienes, abre una terminal y ejecuta:

```bash
node -v
```

Si devuelve un número de versión (p. ej. `v22.x.x`), ya está.

### 2. Descargar el código

Con git instalado:

```bash
git clone https://github.com/Jorge2k1/Pimienta.git
cd Pimienta
```

Si no usas git: en la página de GitHub del repositorio, botón verde
**Code** → **Download ZIP**, y descomprime la carpeta.

> Por defecto, `main` tiene solo la Fase 1 (análisis de la página actual,
> solo texto). Para la versión con pestañas, subida de archivos y señales
> de imagen (Capítulos 2 y 4), después del `git clone` ejecuta:
> ```bash
> git checkout feature/sidepanel-tabs-file-upload
> ```

### 3. Instalar las dependencias

Desde la carpeta del proyecto:

```bash
npm install
```

Tarda uno o dos minutos la primera vez.

### 4. Construir la extensión

```bash
npm run build:extension
```

Esto genera la carpeta `packages/extension/dist` — es lo que carga el
navegador, no el código fuente directamente.

### 5. Cargar la extensión en Edge

1. Abre `edge://extensions` en la barra de direcciones.
2. Activa **Modo de desarrollador** (interruptor abajo a la izquierda).
3. Clic en **Cargar descomprimida**.
4. Selecciona la carpeta `packages/extension/dist`.

### 6. Usarla

1. Clic en el icono de piezas de puzzle de la barra de Edge y fija
   "Evidence Aggregation System" (icono de alfiler).
2. Clic en su icono: se abre el panel lateral.
3. Pestaña **Página actual**: analiza automáticamente la pestaña que
   tengas activa. Pestaña **Analizar archivo** (si estás en la rama del
   Capítulo 2): arrastra o selecciona un archivo propio (`.txt`, `.md`,
   `.html`, `.docx`, `.pdf`).

Si vuelves a modificar el código, repite el paso 4
(`npm run build:extension`) y después pulsa el icono ↻ ("Recargar") en la
tarjeta de la extensión dentro de `edge://extensions`.

---

## Capítulo 1 — Evidence Aggregation System (Fase 1 — texto)

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

---

## Capítulo 4 — Fase 2: señales de imagen (EXIF + C2PA)

Añade evidencia de imagen sumándose al **mismo** `Evidence[]`, **mismo**
Fusion Engine y **misma** UI que el texto — sin `ImageEvidence` paralelo,
sin un segundo motor de fusión. Probado de extremo a extremo contra
imágenes C2PA reales, no solo con fixtures inventadas.

### Generalización previa (antes de escribir código nuevo)

Auditar `Evidence`/`fuse()` reveló que el Fusion Engine, tal como estaba,
no garantizaba lo que pedía el encargo: un promedio ponderado plano
significa que, por muy alto que sea el peso de una señal, sigue siendo un
voto entre otros — un C2PA válido con confianza máxima podía diluirse a
un empate frente a suficiente evidencia en contra. Dos cambios antes de
tocar imagen:

- **`Evidence.sourceId`** (opcional): identifica de qué elemento concreto
  viene cada evidencia (`'page-text'`, o la URL de una imagen). `fuse()`
  no cambia de firma — se llama **una vez por sujeto**, nunca mezclando
  texto e imagen en la misma fusión. Así el texto de la página nunca puede
  diluir la evidencia dura de una imagen, por diseño, no por suerte.
- **Fusión por niveles** en `fusion-engine.ts`: `HARD_EVIDENCE_SIGNALS`
  (de momento solo `c2pa-provenance`) se promedia aparte del resto y
  domina el resultado al 90% frente al 10% de la evidencia blanda. Sin
  evidencia dura, el comportamiento es idéntico byte a byte al promedio
  ponderado de la Fase 1 (verificado con test — no rompe nada existente).

### Señales nuevas (`packages/core/signals/image/`)

- **`exif.ts`**: vía `exifr`, que corre igual en Node que en navegador —
  100% testeable en vitest, como las señales de texto.
- **`c2pa.ts`**: solo el **mapeo puro** de un resultado de verificación ya
  simplificado (`C2paCheckResult`) al `Evidence` genérico. La invocación
  real del SDK (`@contentauth/c2pa-web`) no puede vivir aquí — usa un Web
  Worker del navegador y `fetch()` de un binario WASM, ninguno disponible
  en Node/vitest (verificado al intentarlo: falla con "Worker is not
  defined" y "fetch failed" para `file://`).
- **`known-ai-tools.ts`**: lista de nombres de herramientas de IA
  conocidas, compartida entre `exif.ts` y `c2pa.ts` (antes duplicada).

`c2pa.ts` reconoce el vocabulario IPTC de `digitalSourceType` más allá de
`trainedAlgorithmicMedia` — también `algorithmicMedia`, `dataDrivenMedia`,
`compositeSynthetic` hacia IA, y `computationalCapture`,
`compositeCapture` hacia cámara — encontrado al probar contra fixtures
reales de `c2pa-rs`, no supuesto de antemano. Deliberadamente **no**
incluye valores ambiguos como `digitalArt` o `screenCapture`: pueden ser
100% obra humana y tratarlos como evidencia de IA sería prometer una
certeza que no tenemos.

**Caso "C2PA válido pero sin `digitalSourceType` concluyente"**: no es un
cero plano. Las herramientas de generación de IA tienen un motivo muy
concreto para declarar ese campo (es su forma de cumplir con el Artículo
50 del EU AI Act) — si una herramienta firmó C2PA pero no lo declaró, es
más probable que sea una herramienta sin ese motivo (cámara, editor, test)
que una IA que "se olvidó" de la única razón por la que usaría C2PA.
Confirmado con datos reales: los dos manifiestos de prueba sin
`digitalSourceType` eran de `Truepic_Lens_SDK` (verificación de cámara
real) y `make_test_images` (herramienta de test del propio SDK de C2PA) —
ninguna de las dos es IA. Por eso este caso inclina levemente hacia
humano, con confianza baja, en vez de no aportar nada.

### Extensión: dónde puede vivir cada pieza (varias vueltas de depuración real)

- **`content-scripts/image/image-extractor.ts`**: identifica imágenes
  visibles (`IntersectionObserver`, tanto `<img>` como fondos CSS) —
  **nunca** lee píxeles (choca con la política de "tainted canvas" para
  imágenes cross-origin). Solo manda `{url, elementId, width, height}` por
  `chrome.runtime.sendMessage`.
- El análisis de imagen (fetch, hash, EXIF, C2PA) vive en el **side
  panel**, no en el service worker. Se intentó primero en el service
  worker y se encontraron, en este orden, tres restricciones reales de la
  plataforma (no de configuración):
  1. `import()` dinámico está prohibido por especificación dentro de un
     `ServiceWorkerGlobalScope`.
  2. Crear un `Worker` también está prohibido ahí — y
     `@contentauth/c2pa-web` siempre delega su trabajo de WASM a un
     Worker, sin modo alternativo.
  3. Compilar WebAssembly requiere `'wasm-unsafe-eval'` en el
     `content_security_policy` del manifest (no viene permitido por
     defecto en MV3).

  El side panel es una página normal (ya usa su propio Worker de `pdf.js`
  para leer PDFs), así que ahí sí funciona. `sidepanel/image-analyzer.ts`
  + `sidepanel/c2pa-client.ts` hacen el trabajo real; el service worker
  vuelve a ser mínimo (solo habilita el side panel al hacer clic).

  Un intento posterior de pasar una URL de worker explícita (`workerSrc`)
  para evitar depender de `blob:` falló porque la librería exige que sea
  `https:`, imposible para un origen `chrome-extension://`. Y añadir
  `blob:` a `worker-src` en el CSP del manifest **tampoco es válido**: MV3
  rechaza cargar la extensión entera si lo intentas — es una restricción
  dura, no configurable. La solución final: no pasar `workerSrc` en
  absoluto y dejar que la librería cree su propio worker `blob:`, que sí
  está permitido bajo el CSP por defecto de una página de extensión.

- `manifest.json`: `host_permissions: ["<all_urls>"]` (fetch cross-origin
  de imágenes) y `content_security_policy` con `'wasm-unsafe-eval'`.
- Side panel: tarjeta independiente por imagen (score propio, nunca
  mezclado con el del texto), reutilizando el mismo `renderResult` del
  Capítulo 2.

### Verificado con imágenes C2PA reales

`test-pages/image-analysis.html` incluye tres imágenes con C2PA firmado
de verdad (no simulacros), de repositorios públicos con licencia abierta:
una de Adobe y una de Truepic (`c2pa-org/public-testfiles`), y una de las
fixtures de test del propio SDK de referencia (`contentauth/c2pa-rs`).
Con ellas se depuró el pipeline completo contra un navegador real hasta
confirmar que EXIF y C2PA se leen, verifican y explican correctamente.

### Qué NO cambió

- El texto (Capítulos 1 y 2) sigue exactamente igual — la fusión por
  niveles es idéntica byte a byte al promedio de siempre cuando no hay
  evidencia dura de por medio.
- Sigue sin haber backend: todo el análisis de imagen corre en la propia
  extensión, sin enviar ninguna imagen a servidores externos.

---

## Capítulo 5 — Señales de imagen adicionales: XMP, URL y contexto de página

Amplía la Fase 2 con tres señales más, todas sin ML ni análisis de
píxeles. **Se descartó explícitamente** la vía de análisis de píxeles
(artefactos de compresión, huellas de GAN, FFT, clasificador CNN) — es
justo lo que el encargo original de la Fase 2 excluyó, y las razones
siguen siendo válidas: no hay modelo ligero de confianza, los artefactos
se destruyen con el procesamiento normal de la web (redimensionar,
recomprimir), y un modelo propio o una API externa comprometerían la
misma postura de compliance de todo el proyecto ("nada sale del
navegador"). Ninguna señal nueva analiza contenido de píxeles.

Las tres señales que sí se implementaron:

### `xmp.ts` — el mismo campo que C2PA, sin firma

Muchas herramientas (Photoshop, Lightroom, algunos generadores) escriben
`digitalSourceType` en un bloque XMP incrustado en el archivo sin llegar
a firmar un manifiesto C2PA completo. Verificado directamente: `exifr`
(ya en uso para EXIF) ignora XMP por defecto — hace falta la opción
`{xmp: true}` explícita, sin la cual una imagen con XMP pero sin EXIF
devuelve `undefined`. Con la opción activada, expone `DigitalSourceType`
con el mismo formato de URI que ya usa `c2pa.ts`, así que se creó
`iptc-digital-source-type.ts` — un clasificador compartido entre ambos,
para no mantener la misma lista de valores IPTC en dos sitios. Pesa menos
que C2PA (4 vs. 5) precisamente por no estar firmado: se puede eliminar o
falsificar sin más esfuerzo que editar el archivo. A diferencia de
C2PA, la ausencia de `digitalSourceType` en un bloque XMP **no** se trata
como indicio de "probablemente humano" — firmar C2PA es un acto
deliberado de procedencia, pero un bloque XMP puede existir por motivos
totalmente ajenos (perfil de color, palabras clave, valoración) sin que
quien lo escribió tuviera ningún motivo para declarar origen.

### `url-heuristics.ts` — dominio de alojamiento y nombre de archivo

Analiza la URL de la imagen en sí (`Evidence.sourceId`), sin necesitar
sus bytes: dominios de alojamiento de salidas de generadores de IA
(verificados uno a uno por búsqueda antes de incluirlos — lista
deliberadamente corta y conservadora: `oaidalleapiprodscus.blob.core.windows.net`
de la API de DALL-E, `replicate.delivery`, `cdn.leonardo.ai`) y patrones
de nombre de archivo por defecto de esas mismas herramientas antes de
que el usuario los renombre. Pesa poco (1.2): es circunstancial, basta
con renombrar el archivo o resubirlo a otro sitio para evitarlo.

### `context-text.ts` — lo que el autor de la página escribió sobre la imagen

No es un metadato del archivo, es texto de la propia página: `alt`,
`title` o el `<figcaption>` de un `<figure>`, capturados por
`image-extractor.ts` (nueva función `captureContext`) y enviados junto
al resto del mensaje `EAS_IMAGE_DETECTED`. Solo es evidencia cuando dice
algo explícito ("generado por IA", "AI-generated"...) — su ausencia no
significa nada, la inmensa mayoría de imágenes no llevan ningún aviso.

### Dónde vive el problema de caché

`image-analyzer.ts` cachea EXIF/XMP/C2PA por hash de contenido (dependen
solo de los bytes, es correcto reutilizarlos si la misma imagen
reaparece). La señal de contexto de página **no** se cachea así a
propósito: la misma imagen puede aparecer con un `alt` distinto en cada
sitio donde se use, así que cachearla por hash de contenido devolvería
el contexto de la primera página donde se vio la imagen, no el de la
actual. Se recalcula siempre, por separado del resto — es barata (solo
comparación de texto, sin fetch ni parseo de formato de archivo).

### Arreglo: dos señales no dependían de los bytes de la imagen

`image-url-heuristics` e `image-context-text` no necesitan descargar la
imagen — solo su URL y el texto de contexto. Al integrarlas se calculaban,
por comodidad de código, **después** del `fetch()` de la imagen junto al
resto de señales (EXIF/XMP/C2PA) — así que si esa descarga fallaba (imagen
caída, bloqueada por CORS, dominio con URLs efímeras) se perdía **toda**
la evidencia, incluidas estas dos que no tenían por qué depender de eso.
`sidepanel/image-analyzer.ts` las separa ahora en
`computeUrlAndContextEvidence()`, que corre siempre, en paralelo,
independientemente de si el `fetch()` posterior de los bytes funciona o no.

### Verificado con 5 escenarios reales (no simulados)

`test-pages/image-analysis.html` tiene 5 escenarios, cada uno pensado
para ejercitar una combinación distinta de señales. Dos imágenes se
descargan en directo (Truepic y el `C.jpg` de `c2pa-rs`, ya usadas en el
Capítulo 4); las otras tres son copias locales en `test-pages/assets/`
con metadatos reales **inyectados** — nunca simulados: se descargó el
JPEG real, se insertó un segmento APP1 (EXIF o XMP) real y válido justo
tras el marcador SOI, preservando intactos todos los bytes y segmentos
originales (incluido cualquier manifiesto C2PA ya presente), y se
verificó con `exifr` antes de darlo por bueno:

- **Escenario 3**: otra imagen de test C2PA de Adobe distinta de la del
  escenario 2 (`adobe-20220124-C.jpg`, del mismo repositorio que
  Truepic) — su C2PA es válido pero, a diferencia de la del escenario 2,
  **no** declara `digitalSourceType` (confirmado leyendo el manifiesto
  byte a byte, no asumido), así que es evidencia dura ambigua, leve hacia
  humano. Renombrada a un patrón típico de DALL·E y envuelta en un
  `<figure>` con un `<figcaption>` que declara origen de IA — dos señales
  blandas empujando hacia IA que la evidencia dura debe contener.
- **Escenario 4**: la misma imagen de Truepic del escenario 1 con un
  bloque XMP inyectado que declara `trainedAlgorithmicMedia` — XMP
  empuja con fuerza hacia IA, pero al no estar firmado no puede ganarle
  al C2PA (dura) que sigue dominando hacia humano.
- **Escenario 5**: la misma imagen de Adobe del escenario 3 con el campo
  EXIF `Software: Midjourney 6.1` inyectado, y un `alt` que nombra la
  misma herramienta sin declaración formal — ejercita a la vez la rama
  `matchesKnownAiSoftware` de `exif-metadata` y la rama `matchesKnownTool`
  de `image-context-text`.

### Cómo verificar los datos independientemente

`scripts/inspect-image-metadata.mjs` (ejecutable con
`npm run inspect:image -- "ruta/a/la/imagen.jpg"`) llama a `exifr` con las
mismas dos opciones exactas que usan `readExif()` y `readXmp()`
(`{gps: true}` y `{xmp: true}` respectivamente) sobre cualquier imagen —
no es una reimplementación, es el mismo código de lectura, así que
imprime literalmente lo que la extensión también vio. Para C2PA, que no
puede ejecutarse fuera del navegador (ver Capítulo 4), la vía
independiente es la herramienta de referencia de la Content Authenticity
Initiative, [contentcredentials.org/verify](https://contentcredentials.org/verify)
(arrastrar y soltar, sin instalar nada), o
[c2patool](https://github.com/contentauth/c2patool), la CLI oficial del
mismo equipo que mantiene el SDK que usa la extensión.

### Qué NO cambió

- Ninguna señal existente de la Fase 2 se tocó — `exif.ts`, `c2pa.ts`
  (salvo el refactor a `iptc-digital-source-type.ts` compartido, mismo
  comportamiento) y el Fusion Engine por niveles siguen igual.

---

## Capítulo 6 — UI: qué atributo concreto detectó cada evidencia

Cada evidencia en el side panel mostraba el nombre fijo de su señal (p.
ej. "Procedencia C2PA") más la barra y la frase completa — pero una misma
señal activa ramas muy distintas entre sí (C2PA sin manifiesto, con firma
inválida, declarando IA, declarando cámara...), así que ese nombre por sí
solo no bastaba para saber de un vistazo a qué atributo concreto se
refería la barra. Y, al revés, mostrar siempre la frase completa de cada
evidencia saturaba la vista en cuanto había varias a la vez. Dos cambios,
sin tocar `fuse()` ni el cálculo del score — es puramente explicabilidad:

### `Evidence.aspect` — el atributo concreto, no solo la señal

Campo nuevo, obligatorio, en 2-5 palabras (p. ej. "Origen declarado:
cámara", "Nombre de archivo típico de IA"), distinto del nombre fijo de
la señal y de `humanReadable` (la frase completa). Cada rama de cada una
de las 9 señales (las 4 de texto y las 5 de imagen) tiene ahora su propia
etiqueta. En la UI pasa a ser lo primero y más destacado de cada tarjeta
de evidencia; el nombre de la señal queda como etiqueta de categoría
secundaria, pequeña y en mayúsculas.

### `Evidence.details` — desglose atributo por atributo (de momento, solo C2PA)

Campo nuevo, opcional: una lista de pares `{label, value}` con los datos
crudos concretos que llevaron a la conclusión. Motivado por un caso
concreto: la rama de firma inválida decía "el historial de procedencia no
es de fiar", una frase que no dice **qué** dato exacto falló. Ahora, para
`c2pa-provenance`, cada rama incluye los campos reales que la sustentan
(`Manifiesto C2PA`, `Firma criptográfica`, `digitalSourceType declarado`
— ya recortado al término IPTC, no la URL completa — y `Generador
declarado`), para que se pueda verificar la conclusión contra el dato
crudo sin tener que confiar en la frase en prosa. El mecanismo es
genérico y reutilizable en cualquier otra señal; de momento solo se
rellena en C2PA porque es donde una sola conclusión depende de más
campos distintos a la vez.

### Side panel: plegado por defecto

`sidepanel.ts`/`sidepanel.css` reestructuran cada tarjeta de evidencia en
tres niveles: categoría (nombre de la señal, pequeña y muted) → aspecto
(destacado, encima de la barra) → barra direccional. La frase completa,
el desglose de atributos (si los hay) y la confianza/peso quedan plegados
bajo un desplegable "Por qué", visibles con un clic pero sin saturar la
vista por defecto cuando hay varias evidencias a la vez.

### Qué NO cambió

- `fuse()` y `explain()` no se tocaron — es el mismo score, el mismo
  Fusion Engine por niveles; este capítulo es solo cómo se presenta la
  evidencia que ya se calculaba.
- El campo `details` no se rellenó en EXIF/XMP/URL/contexto en este
  capítulo — quedan con su frase en prosa de siempre, sin desglose.
