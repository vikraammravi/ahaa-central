# SaaS modularization plan

Status: existing feature isolation (Phases 1 and 2) implemented and verified on the feature branch. The additive business foundation passed a staging rollback-only rehearsal; it is not installed. Operational business isolation and superadmin remain subsequent work. Production is unchanged.

## Objective

Preserve Ahaa's current workflows while establishing reusable feature boundaries, then introduce isolated business workspaces and a platform administration experience. Keep the current Next.js deployment and Supabase infrastructure during initial phases.

## Phase 1: Establish boundaries with vendor documents

Use vendor documents as the first vertical slice: it already has shared admin/manager UI, HTTP endpoints, storage and an external scanner. Keep the existing endpoint URLs, permissions, scan limits, categories and database functions unchanged.

- Move receipt UI, browser requests and feature-specific types into src/features/vendor-documents.
- Move server orchestration into src/server/modules/vendor-documents. Separate access checks, receipt persistence and scan orchestration by responsibility, without creating empty abstraction layers.
- Put the Azure client behind a server-only adapter. Keep Supabase server/admin clients server-only and out of browser imports.
- Make route handlers thin adapters for request parsing, service calls and response mapping. Preserve origin validation, scope validation and error/status contracts.
- Preserve colocated tests and separate mocks; add dependency restrictions preventing frontend imports from server modules.
- Keep old import re-exports temporarily where they make the migration smaller; remove them after callers move.

Completion: existing upload, duplicate detection, draft/completed editing, rescan gating, deletion, branch separation and loading behaviour pass. Hosted AI remains disabled. No schema changes and no production deployment as part of a folder move.

## Phase 2: Extract the remaining features incrementally

Order: catering; catalog and locations; inventory; orders and pickup; billing; users and access. Move one feature per reviewable change, with relevant tests and a production build before promotion.

Frontend ownership lives in src/features/<feature>; role routes retain navigation and page composition. Backend ownership lives in src/server/modules/<feature>. Shared visual primitives remain in src/components/ui and src/components/shared. General utilities remain in src/lib; business-specific rules do not accumulate there.

Do not force all reads through new HTTP endpoints during file organization. Introduce stable service/request contracts first and migrate access paths separately when required. Keep database functions responsible for existing atomic operations.

Document cross-module calls: orders coordinates pickup, inventory movements and billing using explicit interfaces and appropriate database transactions. Other modules must not independently write another module's records.

## Phase 3: Design and prove business isolation in staging

- Add businesses and memberships; preserve existing authentication user IDs and map current Ahaa records to one business.
- Distinguish platform staff permissions from customer roles. Memberships support one user participating in multiple businesses.
- Inventory every table, database function, trigger, view, storage policy, API, cache and background operation before changing policies.
- Use an additive migration and backfill, validate ownership and parent/child consistency, then enforce constraints and policies. Branches and records referenced together must belong to the same business.
- Derive or validate business context through authenticated memberships. Never trust a client-supplied business identifier alone. Audit service-role and SECURITY DEFINER paths explicitly.
- Scope storage paths, uniqueness rules, cache keys, usage limits and exports by business as appropriate.
- Start with fixed, supported configuration: branding, timezone, currency, terminology and enabled modules. Define tax/workflow options explicitly rather than permitting arbitrary executable rules.

Completion: two staging businesses with admin/manager/employee fixtures cannot read, insert, update, delete, reference or download each other's records. Include users with multiple memberships and inactive memberships. Migrate production only after staging validation, backup and a documented deployment/rollback sequence. Once multiple tenants exist, rollback must not restore code that bypasses tenant isolation.

## Phase 4: Minimal superadmin

Build only after Phase 3 passes. Initial capabilities: create a business, invite its first owner, activate/suspend access, configure supported modules/branding and view usage. Enforce suspension on server and database paths, not just navigation.

Separate platform authorization from CENTRAL_ADMIN. Existing Ahaa admins do not automatically become platform administrators. Record platform configuration changes in an audit trail. Routine superadmin work should not grant unrestricted browsing of customer records; any future support access requires explicit scope and auditing.

Exclude arbitrary workflow builders, impersonation, subscription charging and industry-wide customization from the first release.

## Phase 5: Independent applications when justified

Extract admin, branch/employee and superadmin into applications in one monorepo. Extract shared UI and contracts into packages. A separate TypeScript API can reuse the server modules when independent deployment is needed. Introduce durable background jobs for scanning, PDF batches and email where request lifetimes are unsuitable.

Separate applications do not provide tenant security by themselves. Validate backend isolation throughout extraction. Keep staging and production databases separate; businesses are tenants within an environment.

## Release discipline

- Work on codex/ feature branches; no automatic promotion to production.
- Keep behaviour changes, schema changes and mechanical moves in separate reviewable steps where possible.
- Run relevant unit/integration tests, type checking, lint and production builds. Verify desktop/tablet/mobile for affected UI; file moves should preserve appearance.
- Measure query latency, payloads and database load before claiming performance improvements or adding infrastructure.

## First deliverable

A vendor-documents module with the existing behaviour intact, a dependency map and verified import boundaries. Follow with one feature at a time. Superadmin begins only after business isolation is tested.
