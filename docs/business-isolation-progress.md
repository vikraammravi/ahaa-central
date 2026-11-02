# Business isolation development checkpoint

Branch: codex/business-isolation. No deployment or permanent database change in this step.

## Implemented

- Shared workspace selection parsing and membership-profile contracts.
- Opt-in session resolver that never falls back to a global role when workspace authorization fails.
- Selected-business header propagation to this project's browser data/storage requests and server session client.
- Current-user provider keys page state by user and business so workspace changes invalidate prior business state.
- Privileged vendor-invoice queries/mutations are business-scoped in workspace mode; new uploads use a business-prefixed path.
- Duplicate restoration uses the saved path for both legacy and business-prefixed originals, avoiding extra copies. Active duplicate responses exclude internal file paths.
- Invoice PDF role checks use the shared resolver. Database queries continue through the authenticated, RLS-protected client.
- Draft service-only receipt creation and scan reservation functions validate business membership and branch scope. Environment-wide 100/month and user-wide 10/day limits remain shared across businesses.

## Feature flag

NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED defaults off. It has not been added to local or hosted environment settings. The subsequent chooser/membership step implements routing and user-management integration; see workspace-membership-progress.md. Do not enable the flag until the complete paired database release and API acceptance checks pass. Enabling it against the existing foundation-only database would fail closed because current_workspace is not installed.

## Database rehearsal

The draft migration and assertions passed in a single staging BEGIN/ROLLBACK transaction, together with the original operations-refactor regression SQL. Tests cover:

- Direct business-row boundaries, membership-specific role/location, ambiguous selection, revoked/suspended access and rejected ownership changes.
- Dashboard/fulfillment RPC boundaries and composite parent/item ownership checks.
- Scoped receipt creation, rejected foreign scans/storage paths and the retained monthly/daily ceilings, without contacting Azure.
- Unchanged existing record values before/after the metadata migration using checksums over every original operational column.
- Existing atomic fulfillment rollback, stale edits, zero quantities, Ready stock deduction and bounded dashboard rules.

Run node scripts/prepare-isolation-rehearsal.mjs to regenerate the rollback-only staging script. It does not connect to a database. The draft remains in supabase/planned; it is not an approved release migration. These checks do not yet cover every callable function or replace HTTP/storage acceptance tests.

## Application verification

The 37 Node unit checks and full 252-test Vitest run passed. After the final receipt-compatibility fix and added page-state test, the 33 focused workspace/vendor-invoice/PDF/current-user checks passed. TypeScript, focused lint, dependency-boundary checks and the final production webpack build passed. No live scan, real receipt upload or business-data mutation was used.

## Next implementation step

The next-step chooser and membership implementation is recorded in workspace-membership-progress.md. Complete the full API/storage/function acceptance matrix before installing isolation or enabling workspace mode in staging. Superadmin follows the isolation acceptance gate.
