# Worker Registry V1

Status: implemented on the V1 feature branch; external review required before merge.

## Aggregate

`Worker` is tenant-private and contains a human display name, optional internal code, finite status,
optional Work Center, optional bounded job-title text, optional same-organization User link,
optional start/end dates, bounded notes, creator, timestamps and optimistic version. V1 reuses the
existing `WorkCenter`; it does not introduce a parallel organization chart or HRIS.

## Invariants

- Every read and mutation is scoped by the authenticated Organization.
- A linked User must have an active Membership in that Organization.
- One User can link to at most one Worker inside one Organization; the same User may have a
  different Worker record in another Organization.
- Creating or linking a Worker never changes Membership count or seat capacity.
- An inactive Worker cannot receive new assignments, but all existing operational history remains.
- Deactivation and updates use optimistic concurrency and are audited.

## API and search

List/search supports server-side name/internal-code/job-title search plus status and Work Center.
Detail returns the human Work Center and linked User summary without exposing credentials or
authorization state as worker identity.

## Product surface

`Personas / Trabajadores` provides a responsive list and a Worker Workspace with Resumen,
Incidentes, EPP and Capacitación. Primary UI uses human Spanish labels and never exposes raw enums,
UUIDs or internal feature keys. The workspace derives a current cross-domain summary from each
source lifecycle and keeps exact links to Incident, EPP and Training records; it does not calculate
a Worker safety score.

## Workforce context V2 candidate

Status: implemented on `feat/workforce-safety-product-refinement-v2`; external review required.

`WorkCenter` remains the physical site, branch, plant or logistics center, and `WorkArea` remains a
subdivision inside that site. A separate `Plant` entity was deliberately not created: the existing
pair represents Quito/Plant A/Production, Quito/Plant B/Administration and Guayaquil/Logistics
Center/Warehouse without an ambiguous extra level. City remains metadata of the Work Center.

`Position` is now an organization-scoped operational role shared by Workers, structured risk
contexts, EPP requirements and training audiences. A Worker may reference one Work Center, one
compatible Work Area and one Position while retaining the legacy free-text job title. All new
fields are nullable so historical workers remain truthful. Cross-tenant and center/area consistency
checks are server-authoritative.

Worker is still not User or Membership. Creating a Worker does not create access, consume a seat or
change a subscription. Inactivation preserves Incident, EPP, Training and future non-clinical SST
history. Payroll, compensation, leave, recruiting, tax and clinical records remain out of scope.
