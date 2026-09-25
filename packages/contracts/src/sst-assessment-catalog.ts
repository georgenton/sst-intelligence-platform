import type {
  SstAssessmentFactDefinition,
  SstAssessmentScopeKind,
  SstAssessmentValueType,
} from './sst-assessment.js';

export const SST_ASSESSMENT_WORK_CENTER_LIMIT = 100;

export const SST_ASSESSMENT_COMMERCIAL_OPTIONAL_FACT_KEYS = new Set([
  'organization.productObjectives',
  'organization.implementationUrgency',
  'organization.estimatedUsers',
  'organization.budgetRange',
  'organization.rolloutPreference',
]);
const SPECIALIST_REQUIRED_FACT_KEYS = new Set([
  'workCenter.activityDescription',
  'workCenter.hasDistinctOperationalZones',
  'workCenter.hasChemicalProcesses',
  'workCenter.hasHighEnergyOperations',
  'workCenter.hasWorkAtHeight',
  'workCenter.hasHotWork',
  'workCenter.hasElectricalWorkOrExposure',
  'workCenter.hasConfinedSpaces',
  'workCenter.hasExternalWorkforce',
  'workCenter.hasCriticalMachinery',
  'workCenter.hasDriversOrTransport',
  'workCenter.hasFireExposure',
]);

const definition = (
  factKey: string,
  topic: string,
  scopeKind: SstAssessmentScopeKind,
  valueType: SstAssessmentValueType,
  questionText: string,
  order: number,
  options: Partial<
    Omit<
      SstAssessmentFactDefinition,
      'factKey' | 'topic' | 'scopeKind' | 'valueType' | 'questionText' | 'order'
    >
  > = {},
): SstAssessmentFactDefinition => ({
  factKey,
  topic,
  scopeKind,
  valueType,
  questionText,
  helpText:
    options.helpText ??
    'Responde con la información disponible. También puedes indicar que aún no la conoces.',
  choices: options.choices ?? [],
  purpose:
    options.purpose ?? `Completar el contexto de ${topic.toLowerCase()} de la evaluación SST.`,
  order,
  sensitivity: options.sensitivity ?? 'MEDIUM',
  unknownAllowed: options.unknownAllowed ?? true,
  authenticatedDerived: options.authenticatedDerived ?? false,
  collectionPolicy:
    options.collectionPolicy ??
    (SST_ASSESSMENT_COMMERCIAL_OPTIONAL_FACT_KEYS.has(factKey)
      ? 'COMMERCIAL_OPTIONAL'
      : SPECIALIST_REQUIRED_FACT_KEYS.has(factKey)
        ? 'SPECIALIST_REQUIRED'
        : 'CONTEXT_RECOMMENDED'),
  relevancePolicy:
    options.relevancePolicy ??
    (SPECIALIST_REQUIRED_FACT_KEYS.has(factKey) ? 'SPECIALIST_PROMOTED' : 'ALWAYS'),
  blocksReadiness:
    options.blocksReadiness ??
    (options.collectionPolicy === 'FOUNDATION_REQUIRED' ||
      SPECIALIST_REQUIRED_FACT_KEYS.has(factKey)),
  allowEmpty: options.allowEmpty ?? false,
  ...(options.min === undefined ? {} : { min: options.min }),
  ...(options.max === undefined ? {} : { max: options.max }),
  ...(options.maxLength === undefined ? {} : { maxLength: options.maxLength }),
});

const choices = (...values: Array<[string, string]>) =>
  values.map(([value, label]) => ({ value, label }));

export const SST_ASSESSMENT_FACT_CATALOG: SstAssessmentFactDefinition[] = [
  definition(
    'organization.country',
    'Perfil organizacional',
    'ORGANIZATION',
    'SHORT_TEXT',
    '¿En qué país opera la organización?',
    10,
    { authenticatedDerived: true, collectionPolicy: 'FOUNDATION_REQUIRED' },
  ),
  definition(
    'organization.sector',
    'Perfil organizacional',
    'ORGANIZATION',
    'SHORT_TEXT',
    '¿Cuál es el sector principal de actividad?',
    20,
    { authenticatedDerived: true },
  ),
  definition(
    'organization.activityDescription',
    'Perfil organizacional',
    'ORGANIZATION',
    'SHORT_TEXT',
    '¿Cómo describirías la actividad principal?',
    30,
  ),
  definition(
    'organization.complementaryActivityDescription',
    'Perfil organizacional',
    'ORGANIZATION',
    'SHORT_TEXT',
    '¿Qué actividades complementarias también realiza la organización?',
    31,
    {
      helpText:
        'Sepáralas de la actividad principal. Si no existen o todavía no están confirmadas, indícalo.',
      maxLength: 2_000,
      collectionPolicy: 'CONTEXT_RECOMMENDED',
    },
  ),
  definition(
    'organization.totalWorkerCount',
    'Personas y operación',
    'ORGANIZATION',
    'INTEGER',
    '¿Cuántas personas trabajan en total?',
    40,
    { min: 1, max: 10_000_000, collectionPolicy: 'FOUNDATION_REQUIRED' },
  ),
  definition(
    'organization.headcountMeaning',
    'Personas y operación',
    'ORGANIZATION',
    'SINGLE_CHOICE',
    '¿Qué representa la cifra total de personas?',
    41,
    {
      choices: choices(
        ['ASSIGNED_TO_ORGANIZATION', 'Personas asignadas a la organización'],
        ['USUAL_PRESENCE', 'Presencia habitual en la operación'],
        ['PAYROLL_SNAPSHOT', 'Corte de nómina'],
        ['OTHER', 'Otro significado'],
      ),
      helpText:
        'Usa el mismo significado al informar cada centro. Si no está confirmado, indícalo como “No lo sé”.',
    },
  ),
  definition(
    'organization.headcountPeriod',
    'Personas y operación',
    'ORGANIZATION',
    'SHORT_TEXT',
    '¿A qué fecha o periodo corresponde la cifra total?',
    42,
    { maxLength: 120 },
  ),
  definition(
    'organization.headcountCoverage',
    'Personas y operación',
    'ORGANIZATION',
    'SINGLE_CHOICE',
    '¿Qué cobertura tiene la cifra total?',
    43,
    {
      choices: choices(
        ['ALL_ACTIVE_WORKERS', 'Todas las personas activas'],
        ['SCHEDULED_WORKERS', 'Personas programadas en el periodo'],
        ['PAYROLL_SNAPSHOT', 'Personas incluidas en el corte de nómina'],
        ['OTHER', 'Otra cobertura'],
      ),
    },
  ),
  definition(
    'organization.headcountOverlap',
    'Personas y operación',
    'ORGANIZATION',
    'BOOLEAN',
    '¿Una persona puede estar contada en más de un centro?',
    44,
    {
      helpText:
        'Solo responde “No” cuando la organización haya confirmado que los centros no se solapan.',
    },
  ),
  definition(
    'organization.workCenterCount',
    'Centros de trabajo',
    'ORGANIZATION',
    'INTEGER',
    '¿Cuántos centros de trabajo tiene la organización?',
    50,
    {
      authenticatedDerived: true,
      min: 1,
      max: SST_ASSESSMENT_WORK_CENTER_LIMIT,
      collectionPolicy: 'FOUNDATION_REQUIRED',
    },
  ),
  definition(
    'organization.strategicProtectionPriorities',
    'Prioridades',
    'ORGANIZATION',
    'MULTI_CHOICE',
    '¿Qué aspectos deseas proteger prioritariamente?',
    60,
    {
      choices: choices(
        ['PEOPLE_AND_HEALTH', 'Personas y salud'],
        ['PRODUCTIVE_CONTINUITY', 'Continuidad productiva'],
        ['BUSINESS_CONTINUITY', 'Continuidad del negocio'],
        ['MACHINERY_AND_INFRASTRUCTURE', 'Maquinaria e infraestructura'],
        ['FINANCIAL_IMPACT', 'Impacto financiero'],
        ['REPUTATION', 'Reputación'],
        ['CONTRACTORS_AND_SUPPLY_CHAIN', 'Contratistas y cadena de suministro'],
        ['PRODUCT_OR_SERVICE_QUALITY', 'Calidad del producto o servicio'],
      ),
      helpText:
        'Elige solo las prioridades principales. Esta selección orienta el contexto y no produce conclusiones legales ni técnicas.',
    },
  ),
  definition(
    'organization.managementSystem',
    'Gestión SST',
    'ORGANIZATION',
    'SINGLE_CHOICE',
    '¿Cómo se gestiona hoy la información SST?',
    70,
    {
      choices: choices(
        ['PAPER', 'Papel'],
        ['SPREADSHEETS', 'Hojas de cálculo'],
        ['SOFTWARE', 'Software'],
        ['OTHER', 'Otro'],
      ),
    },
  ),
  definition(
    'organization.inspectionPractice',
    'Inspecciones',
    'ORGANIZATION',
    'SINGLE_CHOICE',
    '¿Cómo realizan hoy las inspecciones SST?',
    80,
    {
      choices: choices(
        ['NONE', 'No se realizan'],
        ['INFORMAL', 'De forma informal'],
        ['CHECKLISTS', 'Con listas de verificación'],
        ['MANAGED', 'Con seguimiento sistemático'],
      ),
    },
  ),
  definition(
    'organization.inspectionFrequency',
    'Inspecciones',
    'ORGANIZATION',
    'SINGLE_CHOICE',
    '¿Con qué frecuencia se realizan inspecciones SST?',
    90,
    {
      choices: choices(
        ['NEVER', 'Nunca'],
        ['OCCASIONAL', 'Ocasionalmente'],
        ['MONTHLY', 'Mensualmente'],
        ['WEEKLY_OR_MORE', 'Semanalmente o más'],
      ),
      collectionPolicy: 'CONDITIONAL',
      relevancePolicy: 'AFTER_INSPECTION_PRACTICE',
      blocksReadiness: false,
    },
  ),
  definition(
    'organization.manualPermits',
    'Permisos de trabajo',
    'ORGANIZATION',
    'BOOLEAN',
    '¿La organización usa autorizaciones o formatos manuales para controlar trabajos críticos?',
    100,
    {
      helpText:
        'Esto describe el proceso actual. Por sí solo no determina que necesites el módulo de permisos.',
      purpose:
        'Conocer cómo se autorizan hoy los trabajos críticos ayuda a orientar el seguimiento sin asumir que el riesgo existe.',
    },
  ),
  definition(
    'organization.evidenceDifficulty',
    'Evidencia',
    'ORGANIZATION',
    'BOOLEAN',
    '¿Cuesta reunir registros, soportes o evidencias para revisiones SST?',
    110,
    {
      purpose:
        'Esta respuesta ayuda a identificar si conviene ordenar la evidencia y su trazabilidad.',
    },
  ),
  definition(
    'organization.overdueActions',
    'Seguimiento',
    'ORGANIZATION',
    'BOOLEAN',
    '¿Hay acciones SST cuya fecha prevista ya pasó y siguen pendientes?',
    120,
    {
      purpose:
        'Permite reconocer necesidades de seguimiento sin convertir la respuesta en una conclusión de cumplimiento.',
    },
  ),
  definition(
    'organization.recurringFindings',
    'Seguimiento',
    'ORGANIZATION',
    'BOOLEAN',
    '¿Se repiten hallazgos similares en inspecciones, observaciones o seguimientos?',
    130,
    {
      purpose:
        'Ayuda a orientar el seguimiento de recurrencias; no implica por sí sola que hayan ocurrido incidentes.',
    },
  ),
  definition(
    'organization.hasExistingSstWorkPlan',
    'Planificación',
    'ORGANIZATION',
    'BOOLEAN',
    '¿Existe actualmente un plan de trabajo SST?',
    140,
  ),
  definition(
    'organization.multipleShifts',
    'Personas y operación',
    'ORGANIZATION',
    'BOOLEAN',
    '¿La organización opera en múltiples turnos?',
    150,
  ),
  definition(
    'organization.psychosocialReviewNeeded',
    'Contexto preventivo',
    'ORGANIZATION',
    'BOOLEAN',
    '¿La organización ha identificado la necesidad de revisar factores psicosociales?',
    160,
    {
      helpText:
        'Solo contexto organizacional preventivo. No incluyas información personal, médica ni clínica.',
    },
  ),
  definition(
    'organization.stressExposedRolesPresent',
    'Contexto preventivo',
    'ORGANIZATION',
    'BOOLEAN',
    '¿Existen funciones con exposición organizacional a alta carga o presión sostenida?',
    170,
    { helpText: 'Responde sobre funciones, no sobre diagnósticos ni personas identificables.' },
  ),
  definition(
    'organization.organizationalCampaigns',
    'Gestión SST',
    'ORGANIZATION',
    'BOOLEAN',
    '¿Se realizan campañas organizacionales de prevención?',
    180,
  ),
  definition(
    'organization.productObjectives',
    'Objetivos',
    'ORGANIZATION',
    'MULTI_CHOICE',
    '¿Qué objetivos buscas con la plataforma?',
    190,
    {
      choices: choices(
        ['COMPLIANCE', 'Apoyar la gestión de cumplimiento'],
        ['CENTRALIZATION', 'Centralizar información'],
        ['AUTOMATION', 'Automatizar tareas'],
        ['TRACKING', 'Mejorar seguimiento'],
        ['REWORK_REDUCTION', 'Reducir reprocesos'],
        ['RECURRENCE_ANALYSIS', 'Analizar recurrencia'],
        ['REPORTING', 'Mejorar reportes'],
      ),
    },
  ),
  definition(
    'organization.implementationUrgency',
    'Implementación',
    'ORGANIZATION',
    'SINGLE_CHOICE',
    '¿Qué tan pronto necesitas iniciar?',
    200,
    {
      choices: choices(
        ['EXPLORING', 'Estoy explorando'],
        ['THIS_QUARTER', 'Este trimestre'],
        ['THIS_MONTH', 'Este mes'],
        ['IMMEDIATE', 'De inmediato'],
      ),
    },
  ),
  definition(
    'organization.estimatedUsers',
    'Implementación',
    'ORGANIZATION',
    'INTEGER',
    '¿Cuántas personas usarían la plataforma inicialmente?',
    210,
    { min: 1, max: 1_000_000 },
  ),
  definition(
    'organization.budgetRange',
    'Implementación',
    'ORGANIZATION',
    'SINGLE_CHOICE',
    '¿Existe un rango de inversión previsto?',
    220,
    {
      choices: choices(
        ['NOT_DEFINED', 'Aún no definido'],
        ['BASIC', 'Básico'],
        ['STANDARD', 'Estándar'],
        ['ENTERPRISE', 'Enterprise'],
      ),
    },
  ),
  definition(
    'organization.rolloutPreference',
    'Implementación',
    'ORGANIZATION',
    'SINGLE_CHOICE',
    '¿Cómo prefieres realizar la implementación?',
    230,
    {
      choices: choices(
        ['PILOT', 'Piloto controlado'],
        ['PHASED', 'Por fases'],
        ['FULL', 'Despliegue completo'],
      ),
    },
  ),
  definition(
    'organization.additionalContext',
    'Contexto adicional',
    'ORGANIZATION',
    'SHORT_TEXT',
    '¿Hay otro contexto operativo relevante para esta evaluación?',
    240,
    {
      helpText:
        'No incluyas datos personales, médicos, psicosociales individuales, investigaciones privilegiadas, archivos de evidencia ni credenciales.',
      maxLength: 2_000,
      collectionPolicy: 'CONTEXT_RECOMMENDED',
    },
  ),
  definition(
    'workCenter.workerCount',
    'Centro de trabajo',
    'WORK_CENTER',
    'INTEGER',
    '¿Cuántas personas trabajan habitualmente en este centro?',
    1000,
    { min: 1, max: 10_000_000, collectionPolicy: 'CONTEXT_RECOMMENDED' },
  ),
  definition(
    'workCenter.headcountMeaning',
    'Centro de trabajo',
    'WORK_CENTER',
    'SINGLE_CHOICE',
    '¿Qué representa la cifra de personas de este centro?',
    1001,
    {
      choices: choices(
        ['ASSIGNED_TO_ORGANIZATION', 'Personas asignadas a la organización'],
        ['USUAL_PRESENCE', 'Presencia habitual en la operación'],
        ['PAYROLL_SNAPSHOT', 'Corte de nómina'],
        ['OTHER', 'Otro significado'],
      ),
    },
  ),
  definition(
    'workCenter.headcountPeriod',
    'Centro de trabajo',
    'WORK_CENTER',
    'SHORT_TEXT',
    '¿A qué fecha o periodo corresponde esta cifra?',
    1002,
    { maxLength: 120 },
  ),
  definition(
    'workCenter.headcountCoverage',
    'Centro de trabajo',
    'WORK_CENTER',
    'SINGLE_CHOICE',
    '¿Qué cobertura tiene la cifra de este centro?',
    1003,
    {
      choices: choices(
        ['ALL_ACTIVE_WORKERS', 'Todas las personas activas'],
        ['SCHEDULED_WORKERS', 'Personas programadas en el periodo'],
        ['PAYROLL_SNAPSHOT', 'Personas incluidas en el corte de nómina'],
        ['OTHER', 'Otra cobertura'],
      ),
    },
  ),
  definition(
    'workCenter.activityDescription',
    'Centro de trabajo',
    'WORK_CENTER',
    'SHORT_TEXT',
    '¿Qué actividades se realizan en este centro?',
    1010,
    { maxLength: 2_000, collectionPolicy: 'SPECIALIST_REQUIRED' },
  ),
  definition(
    'workCenter.workArrangement',
    'Centro de trabajo',
    'WORK_CENTER',
    'SINGLE_CHOICE',
    '¿Cuál es la modalidad predominante de trabajo?',
    1020,
    {
      choices: choices(['PHYSICAL', 'Presencial'], ['REMOTE', 'Remota'], ['HYBRID', 'Híbrida']),
      collectionPolicy: 'FOUNDATION_REQUIRED',
    },
  ),
  definition(
    'workCenter.activityCategories',
    'Centro de trabajo',
    'WORK_CENTER',
    'MULTI_CHOICE',
    '¿Qué categorías de actividad existen en este centro?',
    1030,
    {
      choices: choices(
        ['ADMINISTRATIVE_SERVICES', 'Servicios administrativos'],
        ['PRODUCTION', 'Producción'],
        ['WAREHOUSE', 'Bodega'],
        ['CONSTRUCTION_ASSEMBLY', 'Construcción o montaje'],
        ['OTHER', 'Otra'],
      ),
      collectionPolicy: 'FOUNDATION_REQUIRED',
    },
  ),
  definition(
    'workCenter.facilityTypes',
    'Centro de trabajo',
    'WORK_CENTER',
    'MULTI_CHOICE',
    '¿Qué tipos de instalación componen este centro?',
    1040,
    {
      choices: choices(
        ['OFFICE', 'Oficina'],
        ['PLANT', 'Planta'],
        ['WAREHOUSE', 'Bodega'],
        ['CONSTRUCTION_SITE', 'Sitio de construcción'],
        ['OTHER', 'Otra'],
      ),
      collectionPolicy: 'CONDITIONAL',
      relevancePolicy: 'PHYSICAL_OR_HYBRID_WORK_CENTER',
      blocksReadiness: true,
    },
  ),
  definition(
    'workCenter.hasDistinctOperationalZones',
    'Centro de trabajo',
    'WORK_CENTER',
    'BOOLEAN',
    '¿El centro tiene zonas operativas claramente diferenciadas?',
    1050,
  ),
  definition(
    'workCenter.hasChemicalProcesses',
    'Exposiciones operativas',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro existen procesos con sustancias químicas?',
    1060,
  ),
  definition(
    'workCenter.chemicalUseContexts',
    'Exposiciones operativas',
    'WORK_CENTER',
    'MULTI_CHOICE',
    '¿En qué contextos se usan sustancias químicas en este centro?',
    1061,
    {
      choices: choices(
        ['CLEANING', 'Limpieza o mantenimiento'],
        ['INDUSTRIAL_PROCESS', 'Proceso industrial'],
        ['STORAGE_OR_HANDLING', 'Almacenamiento o manipulación'],
        ['UNKNOWN_CONTEXT', 'Contexto aún no confirmado'],
      ),
      helpText:
        'Distingue la limpieza química de un proceso industrial para no inferir una exposición que no fue confirmada.',
      collectionPolicy: 'CONTEXT_RECOMMENDED',
    },
  ),
  definition(
    'workCenter.hasHighEnergyOperations',
    'Exposiciones operativas',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro existen operaciones con fuentes de alta energía?',
    1070,
  ),
  definition(
    'workCenter.hasWorkAtHeight',
    'Trabajos críticos',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro se realizan trabajos en altura?',
    1080,
  ),
  definition(
    'workCenter.hasHotWork',
    'Trabajos críticos',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro se realizan trabajos en caliente?',
    1090,
  ),
  definition(
    'workCenter.hasElectricalWorkOrExposure',
    'Trabajos críticos',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro existen trabajos o exposición eléctrica?',
    1100,
  ),
  definition(
    'workCenter.hasConfinedSpaces',
    'Trabajos críticos',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro existen trabajos en espacios confinados?',
    1110,
  ),
  definition(
    'workCenter.hasExternalWorkforce',
    'Contratistas',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro trabaja personal externo o contratista?',
    1120,
  ),
  definition(
    'workCenter.hasCriticalMachinery',
    'Maquinaria',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro existe maquinaria crítica?',
    1130,
  ),
  definition(
    'workCenter.hasDriversOrTransport',
    'Transporte',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro existen conductores u operaciones de transporte?',
    1140,
  ),
  definition(
    'workCenter.hasFireExposure',
    'Emergencias',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro existe exposición a incendio?',
    1150,
  ),
];
