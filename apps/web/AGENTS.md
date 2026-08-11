# Web guide

Use Next.js App Router and keep UI copy in Spanish. Server state belongs in TanStack Query, forms in
React Hook Form, and domain rules in shared contracts rather than components. Access tokens stay in
memory; refresh uses the HttpOnly cookie. Always send the selected organization context through the
API client. Build keyboard-first controls with labels, focus visibility, semantic landmarks, loading,
error, empty, and success states. Keep responsive layouts usable on phone, tablet, and desktop. The
API remains authoritative for roles and entitlements; UI gating only improves usability. Do not
hardcode brand names, plans, limits, or deployment origins.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
