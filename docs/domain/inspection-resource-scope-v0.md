# Inspection Resource Scope V0

Status: implementation candidate; synthetic electrical pilot pending external audit.

## Domain boundary

```text
Inspection Domain
→ Resource Scope
→ Inspection Basis
→ exact ResourceCriterionMappingVersion
→ existing versioned InspectionStandardCriterion records
```

Resource Scope answers which concrete object is inspected. It does not replace Inspection
Standards, Inspection Basis, regulation or Risk Method. V0 uses one primary resource because an
inspection has one coherent checklist and historical snapshot. Multiple resources can be expressed
as separate inspections; a future union model requires explicit product evidence and is not
pre-built.

## Synthetic electrical taxonomy

The append-only global reference taxonomy is visibly `DEMO_SYNTHETIC`:

- MINOR: outlet, plug, extension, power strip, visible cable, luminaire, small equipment.
- MAJOR: panel, breakers, wiring, conduits, grounding, transformer, electrical room.
- INDUSTRIAL_SERVICE: generator, UPS, transfer, MCC, motor, substation, battery bank.

The 21 resources reference existing criterion IDs through immutable mapping versions. Criterion
text is not copied. Reference sync creates no organization or customer data and fails on drift.

## Creation and compatibility

The Workspace V2 flow requires Domain → resource → resolved Basis/standard → mapped criteria. If a
selected resource lacks an exact active mapping, creation is blocked with a configuration message.
The API's explicit no-resource path retains legacy semantics so old clients and historical
inspections remain snapshot-free; there is no inferred resource and no backfill.

V0 mappings address one exact technical standard version. When an active Basis has more than one
executable technical source, a scoped creation is blocked with
`INSPECTION_RESOURCE_MULTI_SOURCE_MAPPING_UNSUPPORTED`; V0 cannot prove that a primary-only mapping
covers supplemental criteria and therefore never narrows them silently. The same Basis remains
executable through the explicit unscoped path, which preserves all source criteria, and existing
inspection snapshots remain unchanged. Complete multi-source resource mapping is a future decision
that requires professional evidence; V0 does not infer, union or downgrade source roles.

A scoped inspection snapshots domain, taxonomy/version/digest, resource, mapping/version/digest,
standard version and ordered criterion IDs. Database protection prevents later rewriting of this
snapshot. Future mappings therefore affect only future inspections.

## Private scope and roles

Organization-private taxonomies/mappings take precedence only inside their organization. Global
content is readable by members; private content is tenant-scoped. Proposal authoring roles are
Owner/Admin/SST Manager/SST Technician/Consultant. Editorial approval/rejection is restricted to
Owner/Admin/SST Manager and remains separate from runtime publication.

## Professional status

The pilot hierarchy and mappings are synthetic engineering fixtures. They are not attributed to
Anita, do not establish Ecuadorian legal requirements and remain pending professional review.
