# Worker Registry V1

Status: authorized implementation contract.

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
UUIDs or internal feature keys.
