# Risk Method Runtime Integration V1

## Vertical slice

```text
Next.js finite renderer
  → authenticated /risk-methods catalog
  → /inspections selected method UUID
  → Nest InspectionsService
  → finite RiskMethodProvider registry
  → pure @sst/contracts calculation
  → Prisma exact input/output/snapshot
```

The API is calculation authority. The frontend collects typed choices and renders returned trace.
The database contains no executable expression and the registry rejects unknown provider keys.

## Reference persistence

Global append-only reference models are separate from the existing regulatory-source and Technical
Risk domains. The production-safe `reference:sync` command provisions one methodology
source/version, three method definitions/versions, one GTC45 source link, one candidate guidance
version and two Ecuador context records. The development seed calls the same synchronizer before
its development-only layers; Railway calls only the synchronizer after migrations. No tenant,
customer record or demo organization is created by reference synchronization.

The migration first creates stable DEMO identity, then backfills existing inspections/findings and
their initial/residual snapshots without recalculation. Static UUID defaults preserve compatibility
for existing controlled fixtures; production create APIs require explicit selection.

## Invariants

- A finding copies the inspection's exact `RiskMethodVersionId`; callers cannot supply another.
- Residual API and PostgreSQL constraint require initial/residual UUID equality.
- Published reference versions reject update/delete, and published method source/context joins
  reject insert/update/delete.
- Initial and recorded residual finding snapshots, inputs, outputs, compatibility values and labels
  are database-immutable.
- Reference synchronization validates schemas and canonical SHA-256 content hashes before
  provisioning, compares stable identities/content without overwriting drift and commits the whole
  aggregate in one serializable transaction.
- Catalog status does not imply legal applicability.
- Recurrence never depends on method score.
- Systemic snapshots retain method identity; raw cross-method arithmetic is forbidden.
- Technical Risk keeps its current method and assessment lifecycle.

## Security

The catalog is authenticated, organization-context validated and gated by the existing inspections
entitlement. Assessment data always derives organization identity from the validated request
context. No request body accepts `organizationId`.
