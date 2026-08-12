# Component Inventory

Scope: current production web UI at `a4242011f0be42c9de8ba319fc7e87b87695f084`. “Shared” means a future web primitive, not a mandate to refactor in this PR.

| Current component/pattern | Current locations | Duplicate? | Future shared primitive | Feature-specific | Claude Design relevance |
|---|---|---:|---|---:|---:|
| Page introduction/header | `PageIntro`, `Intro`, repeated eyebrow/headings | Yes | `PageHeader` with title, description, actions, context | No | High |
| Metric card/grid | dashboards, inspections, technical risk | Yes | `MetricCard`, `MetricGroup` | Data mapping only | High |
| Risk badge | inspections and technical risk local functions | Yes | `RiskBadge` with level text/icon/color | No | High |
| Status badge | `packages/ui`, workflow cards | Partial | `StatusBadge` with semantic variants | Status mapping | High |
| Demo notice/chip/banner | app shell and both SST features | Yes | `DemoNotice`, `DemoBadge` | Disclaimer content | High |
| Card | `packages/ui`, raw `.card` blocks | Partial | `Card`, header/content/footer slots | No | Medium |
| Button/action link | `packages/ui`, `.button` classes | Partial | Button variants, loading, destructive intent | No | High |
| Text input/textarea/select | repeated `.field` markup | Yes | labeled form controls and field message | Schema/options | High |
| Scale question | inspections local `Scale`; technical select questions | Semantic overlap | `QuestionScale` after design validation | Method schema adapter | High |
| Alert/error/success | role alerts, status paragraphs, notices | Yes | `Alert` and `InlineMessage` variants | Copy/recovery action | High |
| Empty/loading state | ad hoc paragraphs/cards | Yes | `EmptyState`, `SectionSkeleton`, `PageError` | Domain copy/actions | High |
| Progress/wizard step | guided diagnostic, finding, assessment | Yes | `Progress`, `WizardStep`, `WizardActions` | Step schema | High |
| Adaptive data row | `.data-row`, result grids | Yes | `DescriptionList` / `DataRow` | Formatting | Medium |
| Operational card | inspection/action/finding/method cards | Partial | shared `ActionCard` anatomy | Strong | High |
| Finding card | inspection detail | No | card anatomy only | Yes | High |
| Method card/notice | technical risk | Partial | Badge/Notice primitives | Yes | High |
| Question input | `TechnicalQuestionInput` | No | field primitives only | Yes | High |
| Review panel/history | assessment detail/review, finding verification | Partial | `ReviewPanel`, `TimelineEntry` after validation | Yes | High |
| Alert item | inspection alerts | No | row/card anatomy | Yes | High |
| Organization switcher | app shell | No | Select + context summary; future mobile Sheet | Yes | High |
| App navigation | app shell sidebar/horizontal mobile strip | No | navigation primitives and active state | Route config | High |
| Confirmation | native `confirm()` | No | accessible `Dialog` | Terminal action copy | High |
| Dense table | not implemented | N/A | Table/Pagination only when a dense list is selected | Columns/filters | Medium |
| Toast | not implemented | N/A | Sonner or equivalent after need is validated | Copy | Medium |

## Package strategy

Keep `packages/ui` for now; a rename to `packages/ui-web` is deferred until Native work creates real ambiguity. New primitives must:

- be explicitly web-only;
- expose accessible behavior and semantic variants rather than feature statuses;
- avoid importing API/domain services;
- own or co-locate their styling contract instead of assuming undeclared app globals;
- include examples/tests appropriate to behavior;
- be added only for an active product surface.

The first extraction candidate is the shared state/status layer (`RiskBadge`, `StatusBadge`, `DemoNotice`, `Alert`, `EmptyState`, `Skeleton`). Forms and navigation should follow after Claude Design validates anatomy.
