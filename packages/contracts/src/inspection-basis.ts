import { z } from 'zod';

export const inspectionBasisTechnicalRoleSchema = z.enum([
  'PRIMARY_TECHNICAL',
  'SUPPLEMENTAL_TECHNICAL',
  'INTERNAL_ORGANIZATION',
]);

const technicalSourceSchema = z.object({
  standardVersionId: z.string().uuid(),
  role: inspectionBasisTechnicalRoleSchema,
  displayOrder: z.number().int().min(1).max(100),
  organizationNote: z.string().trim().min(3).max(500).optional(),
});

const regulatoryUnitSchema = z.object({
  regulatoryUnitId: z.string().uuid(),
  displayOrder: z.number().int().min(1).max(100),
  organizationNote: z.string().trim().min(3).max(500).optional(),
});

const criterionRegulatoryLinkSchema = z.object({
  criterionId: z.string().uuid(),
  regulatoryUnitId: z.string().uuid(),
});

export const inspectionBasisCompositionSchema = z
  .object({
    technicalSources: z.array(technicalSourceSchema).min(1).max(20),
    regulatoryUnits: z.array(regulatoryUnitSchema).max(50).default([]),
    criterionRegulatoryLinks: z.array(criterionRegulatoryLinkSchema).max(200).default([]),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.technicalSources.filter(({ role }) => role === 'PRIMARY_TECHNICAL').length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['technicalSources'],
        message: 'La base requiere exactamente una fuente técnica principal.',
      });
    }
    for (const [path, values] of [
      [
        'technicalSources.standardVersionId',
        value.technicalSources.map((item) => item.standardVersionId),
      ],
      ['technicalSources.displayOrder', value.technicalSources.map((item) => item.displayOrder)],
      [
        'regulatoryUnits.regulatoryUnitId',
        value.regulatoryUnits.map((item) => item.regulatoryUnitId),
      ],
      ['regulatoryUnits.displayOrder', value.regulatoryUnits.map((item) => item.displayOrder)],
      [
        'criterionRegulatoryLinks',
        value.criterionRegulatoryLinks.map(
          (item) => `${item.criterionId}:${item.regulatoryUnitId}`,
        ),
      ],
    ] as const) {
      if (new Set<unknown>(values).size !== values.length) {
        context.addIssue({
          code: 'custom',
          path: [path],
          message: 'La composición contiene duplicados.',
        });
      }
    }
    const selectedUnits = new Set(
      value.regulatoryUnits.map(({ regulatoryUnitId }) => regulatoryUnitId),
    );
    if (
      value.criterionRegulatoryLinks.some(
        ({ regulatoryUnitId }) => !selectedUnits.has(regulatoryUnitId),
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['criterionRegulatoryLinks'],
        message: 'La procedencia de criterio solo puede usar unidades seleccionadas en la base.',
      });
    }
  });

export type InspectionBasisComposition = z.infer<typeof inspectionBasisCompositionSchema>;
