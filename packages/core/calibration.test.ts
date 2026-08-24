import { describe, expect, it } from 'vitest';
import { burstinessSignal } from './signals/text/burstiness';
import { mattrSignal } from './signals/text/mattr';
import { ngramRepetitionSignal } from './signals/text/ngram-repetition';
import { fuse } from './fusion/fusion-engine';

/**
 * Textos de referencia reales, no inventados para hacer trampa: un blog
 * personal casual de 2010 (humano, verificado manualmente), un fragmento
 * narrativo con frases muy variadas (humano), y un texto corporativo
 * deliberadamente repetitivo (patrón típico de IA). Sirven de ancla para
 * que la calibración de los pesos/umbrales no vuelva a desviarse hacia el
 * punto neutro para texto humano real, como pasó con la fórmula de
 * burstiness original.
 */
const REAL_HUMAN_BLOG = `Estoy feliz, no puedo creer que este día haya llegado. Hace un año me preguntaba varias cosas al empezar este blog, y una de ellas fue si llegaría a esta fecha ¡y lo he logrado! Sin ningún tipo de obligación, ha sido todo una jornada de puro placer y diversión.

Tener un blog ha sido un estímulo para pintar y dibujar: ambas cosas me gustan, pero sin el blog no hubiera hecho ni siquiera lo poco que logré hacer este año.

Conocí gente maravillosa a través del contacto en sus blogs y en el mío. Valoro mucho las amistades y la cercanía que hemos ido construyendo durante este año.

Ha sido una oportunidad para mostrar lo que me gusta hacer, pues no lo había hecho antes, y se siente muy bien :)

Mi blog se convirtió en mi espacio personal. Yo no salgo mucho para hacer cosas para mí, y dedico mucha parte de mi tiempo a mis hijos. Así que mi blog se convirtió en un oasis "a prueba de niños", donde encuentro compañía especial y estímulo para pintar.

Además, es rico decir de vez en cuando "tengo mi blog", eso me hace sentir importante :)`;

const NARRATIVE_HUMAN_TEXT = [
  'Ayer volví al pueblo después de casi diez años. La casa de mis abuelos seguía en pie, aunque el tejado se había hundido un poco por el lado norte. Entré. Olía a humedad y a madera vieja, ese olor que nunca se me olvidó del todo.',
  'Encontré, debajo de una manta apolillada, un cuaderno con dibujos que hice cuando tenía siete años; algunos eran de dinosaurios imposibles, con demasiadas patas y colas bifurcadas, otros eran mapas de un tesoro que nunca existió pero que yo defendía con total convicción ante cualquiera que se atreviera a dudarlo. Me senté en el suelo, entre el polvo y los recuerdos, y estuve ahí un buen rato sin hacer nada, solo mirando.',
  'Después salí al patio. La higuera seguía creciendo torcida, como siempre, empujando una de las tejas del cobertizo. Recogí dos higos maduros y me los comí sentado en el escalón de piedra donde mi abuelo solía fumar en pipa mientras contaba historias que probablemente se inventaba sobre la marcha.',
  'No sé cuánto tiempo pasé ahí. Cuando por fin me levanté, el sol ya se estaba poniendo detrás de la sierra, y pensé que quizás debería volver más a menudo, aunque sé, en el fondo, que probablemente no lo haré. Cerré la puerta despacio, como si pudiera despertar a alguien, y me fui caminando hasta el coche sin mirar atrás ni una sola vez.',
].join('\n\n');

const AI_CORPORATE_TEXT = `La inteligencia artificial está transformando el mundo empresarial. La inteligencia artificial mejora la eficiencia operativa. La inteligencia artificial permite automatizar procesos repetitivos. La inteligencia artificial reduce los costes operativos de forma significativa.

La inteligencia artificial ayuda a las empresas a tomar mejores decisiones. La inteligencia artificial optimiza la gestión de recursos humanos. La inteligencia artificial facilita el análisis de grandes volúmenes de datos. La inteligencia artificial impulsa la innovación en todos los sectores.

Las empresas que adoptan la inteligencia artificial obtienen ventajas competitivas claras. Las empresas que adoptan la inteligencia artificial mejoran su productividad general. Las empresas que adoptan la inteligencia artificial reducen sus tiempos de respuesta de forma notable.

En conclusión, la inteligencia artificial representa una oportunidad estratégica clave para el futuro de cualquier organización moderna. Adoptar la inteligencia artificial hoy es preparar el crecimiento sostenible del mañana.`;

/**
 * Texto de IA "difícil": no repite frases literalmente (varía las
 * entidades nombradas en cada ejemplo), así que ngram-repetition apenas lo
 * detecta, y su vocabulario técnico amplio (Tesla, FICO, AUC, mAP...)
 * hace que MATTR lo lea como si fuera humano. Solo burstiness lo detecta
 * bien por sí solo. Es el caso que expuso que el rango de scores estaba
 * comprimido por debajo de 50% incluso para IA confirmada.
 */
const AI_TECHNICAL_TEXT = `Accuracy for systems refers to the degree to which an AI system's outputs correctly represent or predict the real-world phenomena it is intended to measure, classify, or decide upon. For an AI system, this concept extends beyond model accuracy to encompass the end-to-end performance of the deployed solution including data processing, model integration, user interaction, and post-processing components.

System accuracy reflects how consistently and correctly the system performs its intended purpose under normal operating conditions and foreseeable variations (Article 15 EU AI Act). Ensuring and documenting accuracy is a legal obligation for High-Risk AI systems, requiring continuous monitoring, validation against defined performance thresholds.

For an airport VIP-lounge optimisation system, driven by passenger-flow prediction and dynamic pricing strategies, accuracy concerns the system's actual ability to improve revenue performance. Based on flight histories and predictive pipelines, the system must forecast demand and adjust pricing throughout the day to maximise profitability. The central metric is the percentage uplift in revenue compared with the organisation's previous static pricing strategy: how much the margin improves when the system's predictions and automated pricing are applied, and how consistently that improvement is sustained across operational periods.

For a medical diagnostic system deploying Google's Inception-v3 model to assist radiologists in detecting diabetic retinopathy or skin cancer, system accuracy encompasses not only the model's classification performance but the entire diagnostic workflow.

It includes pre-processing pipelines that standardize image quality across devices, integration with hospital information systems (HIS), and user interfaces that present diagnostic probabilities clearly to clinicians. System-level validation assesses whether the entire process from image capture to physician review produces accurate and actionable diagnostic results.

Accuracy is measured through sensitivity, specificity, and AUC (Area Under the ROC Curve) at the system level, verified across diverse clinical environments. Ongoing performance monitoring ensures that calibration remains consistent despite hardware updates, demographic variation, or environmental factors. Corrective feedback loops, governed under Article 15, enable retraining and software updates to sustain diagnostic accuracy and patient safety.

In Tesla's Autopilot, system accuracy extends beyond the vision model's ability to detect road elements to include the reliability of sensor fusion, real-time decision-making, and actuation subsystems.

Evaluation considers whether sensor data from cameras, radar, and ultrasonic inputs are correctly processed, fused, and interpreted to generate safe driving actions under variable conditions (e.g., weather, lighting, or occlusion). Metrics such as mean Average Precision (mAP) and Intersection-over-Union (IoU) are complemented by system-level measures including lane-keeping accuracy, object tracking consistency, and reaction latency to verify operational integrity.

Continuous fleet data collection and post-deployment validation are critical to maintaining accuracy as new driving scenarios emerge. The system's performance monitoring and over-the-air (OTA) update mechanisms enable dynamic recalibration, ensuring adherence to the safety and reliability standards required under Article 15 for high-risk autonomous systems.

In FICO's Falcon Fraud Manager, system accuracy refers to the correctness and reliability of the entire fraud detection process from data ingestion through alert generation and operator review.

Accuracy depends on more than the model's precision and recall. It requires consistent preprocessing of real-time transaction data from multiple sources, integration with banking infrastructure, and decision-support interfaces that enable human analysts to review flagged transactions effectively.

System-level evaluation examines how accurately the end-to-end pipeline identifies fraudulent activity without disrupting legitimate transactions. Metrics such as precision, recall, false positive rate, and alert resolution time are used in conjunction with user feedback to assess practical performance.

Continuous monitoring of transaction patterns, model drift, and analyst outcomes ensures the system maintains calibrated accuracy as fraud strategies evolve. Governance mechanisms, including feedback loops and retraining protocols, ensure conformity with the reliability and traceability provisions of the EU AI Regulation (Articles 13 and 15 of the EU AI Act).`;

function scoreOf(text: string): number {
  const evidence = [
    burstinessSignal.compute({ text }),
    mattrSignal.compute({ text }),
    ngramRepetitionSignal.compute({ text }),
  ];
  return fuse(evidence).score;
}

/**
 * Márgenes por debajo/encima de 0.5, no solo "menor/mayor que 0.5": la
 * calibración original no era solo neutra, estaba realmente desplazada
 * (humano ~30%, IA ~38-40%). Estos márgenes obligan a una separación real.
 */
const CLEARLY_HUMAN = 0.48;
const CLEARLY_AI = 0.52;

describe('calibración de referencia', () => {
  it('un blog personal casual real queda claramente del lado humano', () => {
    expect(scoreOf(REAL_HUMAN_BLOG)).toBeLessThan(CLEARLY_HUMAN);
  });

  it('un texto narrativo con frases muy variadas queda claramente del lado humano', () => {
    expect(scoreOf(NARRATIVE_HUMAN_TEXT)).toBeLessThan(CLEARLY_HUMAN);
  });

  it('un texto corporativo repetitivo queda claramente del lado de IA', () => {
    expect(scoreOf(AI_CORPORATE_TEXT)).toBeGreaterThan(CLEARLY_AI);
  });

  it('un texto técnico de IA sin repetición literal ni vocabulario pobre también queda del lado de IA', () => {
    expect(scoreOf(AI_TECHNICAL_TEXT)).toBeGreaterThan(CLEARLY_AI);
  });
});
