# Screen Inventory for Claude Design

Exactly 12 representative screens are selected. They show the current hierarchy and problems rather than a polished redesign. All authenticated captures use synthetic Gate 3 data.

| # | Screen | Route | Viewport | Screenshot | Why selected / current issue |
|---:|---|---|---|---|---|
| 1 | Login | `/auth/login` | Desktop 1440x900 | `01-login-desktop.png` | Public-to-private boundary; simple but weak product context and recovery affordances. |
| 2 | Dashboard | `/app` | Desktop 1440x900 | `02-dashboard-desktop.png` | Organization, demo, metrics, module access; information is broad but priority/next action is weak. |
| 3 | Inspections dashboard | `/app/inspections` | Desktop 1440x900 | `03-inspections-dashboard-desktop.png` | Operational metrics and recent work; should evolve toward triage. |
| 4 | New inspection | `/app/inspections/new` | Mobile 390x844 | `04-new-inspection-mobile.png` | Core field start; shell/topbar dominate phone space. |
| 5 | Finding detail/action | `/app/inspections/:id/findings/:findingId` | Mobile 390x844 | `05-finding-detail-mobile.png` | Risk, recurrence, action, verification in one long flow; hierarchy needs design. |
| 6 | Alerts | `/app/inspections/alerts` | Desktop 1440x900 | `06-alerts-desktop.png` | Attention queue and acknowledgement; prioritization/filter behavior is immature. |
| 7 | Technical Risk dashboard | `/app/technical-risk` | Desktop 1440x900 | `07-technical-risk-dashboard-desktop.png` | Analytics, method/version, reviewed/completed states. |
| 8 | New Technical Assessment | `/app/technical-risk/new` | Mobile 390x844 | `08-new-technical-assessment-mobile.png` | Versioned five-step method; must preserve context and disclaimer on phone. |
| 9 | Technical Assessment result | `/app/technical-risk/:id` | Desktop 1440x900 | `09-technical-assessment-result-desktop.png` | Deterministic score 20 / Critical, responses, evidence, disclaimer, review state. |
| 10 | Professional Review | `/app/technical-risk/:id/review` | Desktop 1440x900 | `10-professional-review-desktop.png` | High-consequence decision surface; approval is review, never certification. |
| 11 | Organization switch/context | `/app/organizations` | Desktop 1440x900 | `11-organization-context-desktop.png` | Multi-tenant mental model and global context control. |
| 12 | Entitlement/upgrade state | `/app/modules` on a Free organization | Mobile 390x844 | `12-entitlement-upgrade-mobile.png` | Explains unavailable capabilities without confusing UI hiding with authorization. |

## Capture provenance

- Production UI: `https://sst-intelligence-demo.vercel.app`
- Production code SHA: `a4242011f0be42c9de8ba319fc7e87b87695f084`
- Capture date: 2026-08-12
- Synthetic organizations: “Industria Gate 3 …” and “Contexto limitado …”
- Synthetic person label: “Usuario Gate 3”
- No customer data, secrets, tokens, browser storage, request payloads, or backend dumps are included.

Desktop captures use 1440x900; mobile captures use 390x844. Files are optimized PNGs (~33–96 KB each) and live in `design-handoff/screenshots/`.
