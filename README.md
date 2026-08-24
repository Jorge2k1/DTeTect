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
npm test              # vitest en core + extension (29 tests)
npm run typecheck
npm run build:extension   # genera packages/extension/dist
```

Para probar la extensión: `edge://extensions` → activar "Modo de
desarrollador" → "Cargar descomprimida" → seleccionar
`packages/extension/dist`. Las páginas en `test-pages/` sirven para probar
sin depender de un sitio real (requiere activar "Permitir acceso a las URL
de archivo" en los detalles de la extensión).

### Próximos pasos

1. Implementar perplexity real vía ONNX Runtime Web (modelo pequeño tipo
   distilgpt2), sustituyendo el stub sin tocar el Fusion Engine ni la UI.
2. V2: señales de imagen (C2PA, Content Credentials, EXIF) sumándose al
   mismo `Evidence[]` y a la misma UI.
