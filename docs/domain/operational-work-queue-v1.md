# Operational Work Queue V1

Status: implemented read projection.

## Projection boundary

The queue is a tenant-scoped projection over specialized domains, not a universal workflow table.
Source records retain their own lifecycle and canonical deep link. V1 projects:

- open inspection corrective actions and systemic reviews;
- completed Technical Risk assessments awaiting review or carrying `NEEDS_REVISION`;
- Unified SST Evaluation items requiring expert regulatory review;
- active Obligation Execution records;
- work permits pending approval, suspended or due for action.

Queries run in parallel with bounded projections and selected relations, avoiding per-row lookups.
PostgreSQL indexes remain the scaling mechanism; no cache, search service or new infrastructure is
introduced.

## Deterministic ordering

The pure ranking contract orders: overdue urgent/high work, other overdue work, due-soon work,
professional approvals/reviews, blocked or suspended work, then normal active work. Within a rank,
due date, creation time and stable source identifier break ties. The projection never compares raw
scores from different risk methods.

## Query contract

Pagination is explicit. Filters cover status, work center, assignee/requester, due range, source
module and priority. Results include human context, due state, source module, assignee, work center,
regulatory candidate label where relevant, risk method identity where relevant and a canonical deep
link. The API derives the organization exclusively from authenticated context.

## Safety semantics

Candidate regulatory context is visibly labeled and does not become an approved obligation.
Completion, approval and verification remain actions in their originating domains; the queue does
not bypass authorization or mutate source state.
