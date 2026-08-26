// Presentation-only labels. The API/domain provider remains calculation authority.
type GuidedCriterion = {
  value: number;
  label: string;
  meaning: string;
  cues: readonly { key: string; label: string }[];
};

export const guidedProbabilityCriteria: readonly GuidedCriterion[] = [
  {
    value: 1,
    label: 'Remota',
    meaning: 'La materialización requiere condiciones poco habituales.',
    cues: [
      { key: 'NO_RECENT_OCCURRENCE', label: 'No hay ocurrencias recientes conocidas.' },
      { key: 'STRONG_INDEPENDENT_CONTROLS', label: 'Existen controles fuertes e independientes.' },
    ],
  },
  {
    value: 2,
    label: 'Improbable',
    meaning: 'La exposición es limitada y los controles son consistentes.',
    cues: [
      { key: 'LIMITED_EXPOSURE', label: 'La exposición es limitada.' },
      {
        key: 'CONTROL_COVERAGE_HIGH',
        label: 'Los controles cubren la mayor parte de la operación.',
      },
    ],
  },
  {
    value: 3,
    label: 'Posible',
    meaning: 'La combinación de exposición y controles permite que el evento ocurra.',
    cues: [
      { key: 'OCCASIONAL_EXPOSURE', label: 'La exposición ocurre de forma ocasional.' },
      { key: 'CONTROL_GAPS_KNOWN', label: 'Se conocen brechas de control.' },
    ],
  },
  {
    value: 4,
    label: 'Probable',
    meaning: 'La exposición o las fallas conocidas hacen razonable esperar el evento.',
    cues: [
      { key: 'FREQUENT_EXPOSURE', label: 'La exposición es frecuente.' },
      { key: 'RECURRING_FAILURES', label: 'Se han observado fallas recurrentes.' },
    ],
  },
  {
    value: 5,
    label: 'Casi segura',
    meaning: 'La exposición es continua o no existe una barrera confiable.',
    cues: [
      { key: 'CONTINUOUS_EXPOSURE', label: 'La exposición es continua.' },
      {
        key: 'CONTROLS_ABSENT_OR_INEFFECTIVE',
        label: 'Los controles son inexistentes o ineficaces.',
      },
      {
        key: 'HIGH_HUMAN_DEPENDENCY',
        label: 'El control depende principalmente de conducta humana.',
      },
    ],
  },
] as const;

export const guidedHumanSeverityCriteria: readonly GuidedCriterion[] = [
  {
    value: 1,
    label: 'Menor',
    meaning: 'Daño reversible que normalmente no genera incapacidad.',
    cues: [{ key: 'REVERSIBLE_NO_LOST_TIME', label: 'Efecto reversible sin tiempo perdido.' }],
  },
  {
    value: 2,
    label: 'Moderada',
    meaning: 'Puede requerir atención y recuperación breve.',
    cues: [{ key: 'SHORT_RECOVERY', label: 'Se requiere recuperación breve.' }],
  },
  {
    value: 3,
    label: 'Seria',
    meaning: 'Puede producir incapacidad temporal relevante.',
    cues: [{ key: 'TEMPORARY_INCAPACITY', label: 'Existe posibilidad de incapacidad temporal.' }],
  },
  {
    value: 4,
    label: 'Muy seria',
    meaning: 'Puede producir daño irreversible o incapacidad permanente.',
    cues: [{ key: 'PERMANENT_IMPAIRMENT', label: 'Existe posibilidad de incapacidad permanente.' }],
  },
  {
    value: 5,
    label: 'Catastrófica',
    meaning: 'Puede producir una o más fatalidades.',
    cues: [{ key: 'FATALITY_POSSIBLE', label: 'La peor consecuencia incluye fatalidad.' }],
  },
] as const;

export const gtc45DeficiencyOptions = [
  { key: 'VERY_HIGH', value: 10, label: 'Muy alto' },
  { key: 'HIGH', value: 6, label: 'Alto' },
  { key: 'MEDIUM', value: 2, label: 'Medio' },
  { key: 'LOW', value: null, label: 'Bajo' },
] as const;

export const gtc45ExposureOptions = [
  { value: 4, label: 'Continua', meaning: 'Exposición sostenida o repetida durante la jornada.' },
  { value: 3, label: 'Frecuente', meaning: 'Exposición varias veces durante la jornada.' },
  { value: 2, label: 'Ocasional', meaning: 'Exposición alguna vez y durante un periodo corto.' },
  { value: 1, label: 'Esporádica', meaning: 'Exposición eventual.' },
] as const;

export const gtc45ConsequenceOptions = [
  { value: 100, label: 'Mortal o catastrófica', meaning: 'Puede ocasionar una o más muertes.' },
  { value: 60, label: 'Muy grave', meaning: 'Puede ocasionar daño grave irreversible.' },
  { value: 25, label: 'Grave', meaning: 'Puede ocasionar incapacidad laboral temporal.' },
  { value: 10, label: 'Leve', meaning: 'Puede ocasionar daño sin incapacidad.' },
] as const;
