# Applicability & Configuration Experience V1

## Scope and route map

This frontend-only increment exposes the deterministic Applicability Engine through three authenticated routes:

| Route | Purpose |
| --- | --- |
| `/app/applicability` | Profile, active rule-pack and immutable assessment history workspace |
| `/app/applicability/new` | Explicit profile-version creation followed by explicit evaluation |
| `/app/applicability/[id]` | Persisted assessment result, provenance, decisions and trace |

The AppShell exposes the workspace as **Configuración SST**. No Applicability entitlement, commercial-plan filter or Command Center metric is added.

## Workspace

The workspace answers which SST profile version is latest, which prior versions remain available, which active rule packs the server currently exposes, and which evaluations were previously persisted. Counts are limited to real profile, assessment and returned-decision counts. Empty, loading, request-error and populated states remain distinct.

## Profile-version journey

The guided journey has four visible steps: Perfil SST, Confirmar versión, Motor de reglas and Evaluar. Creating a profile version and executing an assessment are separate mutations. A successful profile creation remains on the confirmation step and explicitly states that no assessment exists yet.

Profile versions are append-only. The UI offers no edit, delete or save-in-place affordance; a changed fact requires another version.

## Derived versus managed fields

Country, sector and work-center count are derived by the server from the validated active organization. They do not exist in the browser mutation payload. Before creation, copy explains their derivation. After creation, the persisted snapshot returned by the server is rendered as authority.

The managed V1 fields are optional worker count, chemical-process presence and high-energy-operation presence. Worker count is submitted only when a valid integer is present.

## Unknown semantics

Each optional boolean offers Sí, No and No tengo información. Unknown omits the property instead of sending `false` or `null`. A blank worker count is also omitted and never converted to zero. This preserves the server's ability to return `NEEDS_INFORMATION`.

## Rule-pack selection

The UI queries the active catalog and renders every returned option with name, key, version, source type, demo status, regulatory flag and disclaimer. No pack ID is hardcoded. The user explicitly selects and confirms a version before evaluation.

## Assessment result and state copy

The result renders server-returned decisions and count groups. It never evaluates predicates, applies state precedence or chooses a winning rule. State presentation is:

- `MANDATORY`: Obligatorio en esta demostración.
- `RECOMMENDED`: Recomendado.
- `OPTIONAL`: Opcional.
- `NOT_APPLICABLE`: No aplica en esta demostración.
- `NEEDS_INFORMATION`: Falta información.
- `NEEDS_EXPERT_REVIEW`: Requiere revisión profesional.

Canonical state values remain visible in the audit presentation. Text and symbols accompany semantic color tokens.

## Trace UX

Each decision provides a native disclosure titled **Ver por qué**. It renders the persisted winning rule, all returned rule traces, composition, rule result, configured and contributed states, reason code and explanation. Predicate rows show field, operator, expected value, observed value and canonical result. `null/MISSING` is presented primarily as **Sin información**; `FALSE` means only that a condition did not match.

## Snapshot authority

Historical detail derives profile and rule-pack presentation from `assessment.profileSnapshot` and `assessment.rulePackSnapshot`. It does not substitute current profile values or the active rule-pack catalog. Re-evaluation navigates to the new flow and never overwrites an assessment.

## Roles

`ORG_OWNER`, `ORG_ADMIN` and `SST_MANAGER` receive profile-create and evaluate affordances. `SST_TECHNICIAN`, `CONSULTANT` and `VIEWER` receive the complete read-only workspace and detail experience. API guards remain authoritative.

## Tenant and cache behavior

Every request uses the existing authenticated request pipeline with `organization.activeId`; there is no organization input or query-string tenant identity. Query keys are rooted at the private organization scope for profile versions, active rule packs, assessment history and assessment detail. Query functions propagate `AbortSignal`. Profile creation invalidates only the profile list; evaluation invalidates only assessment history and seeds the exact organization-scoped detail returned by the server. Existing tenant reconciliation is unchanged.

## Demo boundary

The authoritative disclaimer remains prominent: **Reglas sintéticas de demostración. No representan normativa ni acreditan cumplimiento legal.** Results are described as a deterministic diagnostic or demonstrative configuration proposal. They do not activate a configuration and are not a compliance audit, certificate, legal conclusion or Ecuador regulatory implementation.

## Responsive and accessible behavior

The experience uses semantic tokens in Operativo, Sereno, Noche and Alto Contraste. At tablet, 200% reflow and 320px widths, grids collapse into stacked key/value rows and trace content wraps without a wide audit table. Forms use labels, fieldsets and legends; status/error messages use live or alert semantics; native links, buttons, radios and details/summary preserve keyboard behavior and focus visibility.

## Future boundaries

Configuration activation is future work: there is no apply, activate, module-entitlement, program-generation or inspection-depth action. Management of Change and profile/assessment comparison are future work. Professional review for Applicability is future work. Real regulatory content and source governance are future work. No AI explanation or rule editor is introduced.
