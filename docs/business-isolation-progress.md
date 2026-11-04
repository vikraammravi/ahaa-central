# Business isolation development checkpoint

Current release status (November 4, 2026): isolation is installed and workspace mode is enabled in both staging and production. Staging passed live two-business acceptance; production passed migration, access and signed-in admin smoke checks. The basic platform dashboard remains on its separate staging-backed Vercel URL. Onboarding remains deferred. Earlier sections below describe implementation/rehearsal history; see the production promotion section for current evidence.

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
- Restricted execution privileges, cross-business invoice/pickup operations, and private receipt-bucket policy checks. A narrow request-identity helper supports the restricted database role without granting access to the Auth schema.
- The function-owner audit checks every overload of the listed operational security-definer functions, including inventory state and catalog guards. It also verifies that the new receipt functions are service-only and the unscoped legacy receipt functions are no longer executable.
- Synthetic storage-object metadata for both businesses ensures the private-file policy is exercised even if the bucket has no existing objects; no file content is created and the metadata rolls back. Separate inventory fixtures check that a user who is a manager in one business and employee in another sees only the selected business's inventory.

Run node scripts/prepare-isolation-rehearsal.mjs to regenerate the rollback-only staging script. It does not connect to a database. The draft remains in supabase/planned; it is not an approved release migration. These checks do not yet cover every callable function or replace HTTP/storage acceptance tests.

The expanded rollback rehearsal passed on staging. A local staging snapshot covers 20 application tables and three receipt files. A public-schema archive was restored into disposable PostgreSQL 17 with placeholder Supabase roles and Auth dependencies; the restored schema contained 20 tables, 27 policies and 47 functions. The saved rows were also restored locally and compared with the snapshot across all 20 tables. The row test disabled triggers and constraints and used placeholder Auth objects. These checks do not prove complete Supabase recovery: managed Auth, actual database roles, Auth passwords and storage objects are excluded from the schema archive, and the managed project has not been restored. The corrected production connection backup was checked against the production project; a connection file is not a database backup.

The combined rollback-only rehearsal was rerun on November 4 with additional cross-business order-deletion and inventory-update assertions. It passed, and a subsequent read-only verification confirmed that operational isolation remained unapplied on staging and no SaaS foundation was installed on production. These SQL tests do not replace real HTTP, storage and browser acceptance against the installed staging release.

## Application verification

The 37 Node unit checks and full 252-test Vitest run passed. After the final receipt-compatibility fix and added page-state test, the 33 focused workspace/vendor-invoice/PDF/current-user checks passed. TypeScript, focused lint, dependency-boundary checks and the final production webpack build passed. No live scan, real receipt upload or business-data mutation was used.

## Next implementation step

The next-step chooser and membership implementation is recorded in workspace-membership-progress.md. Complete the full API/storage/function acceptance matrix before installing isolation or enabling workspace mode in staging. Superadmin follows the isolation acceptance gate.

## Narrowed delivery scope: basic dashboard and isolation

The user deferred business registration, owner creation, activation and onboarding. The basic platform dashboard is already implemented. `scripts/prepare-isolation-release.mjs` now prepares isolation/membership-only staging and production packages with manifests; production additionally includes its missing foundation, but no platform-admin bootstrap. Default mode is rollback rehearsal and the script never connects to a database.

The narrowed staging rehearsal passed with private receipt-bucket, storage RLS, trigger and operational privilege checks. The workspace-enabled webpack build, TypeScript, module boundaries and 99 affected workspace/backend/platform regression tests passed. The PDF endpoint now returns a private 400 response for malformed workspace-selection cookies; unexpected initialization errors remain private 500 responses.

`scripts/test-staging-isolation.mjs` prepares actual authenticated Data API/PDF/file checks after cutover, with separate fixture preparation and no Azure scans. Offline validation is not live acceptance. Automatic approval review initially rejected saving the staging flag before the matching database/app prerequisites were complete.

After explicit coordinated-cutover approval, commit `d839a7e` was pushed to staging (not main), the isolated staging database transaction committed and the workspace flag was saved for the staging branch only. Workspace-enabled Vercel deployment `CebTfC1BHEvfdqrLrpxDW39FPsGq` reported Ready after email reauthentication. A live malformed-cookie API check returned 400, confirming the workspace-enabled handler is active.

Live staging acceptance passed 17 scenario groups across admin, manager, employee and shared identities: own-business positive controls, foreign-record denial, invoice PDF bytes, private signed originals, invalid selections, revoked access and anonymous denial. Disposable setup also passed canonical Ready stock deduction, pickup completion, invoice combining/sending, and unchanged pre-existing stock checks. Both exact test originals and all generated fixture rows/memberships were removed with guarded cleanup; post-cleanup checks confirmed only isolated Ahaa remains and all three Ahaa roles resolve their own workspace. The authenticated platform-directory HTTP check passed. No emails, new Auth accounts or Azure scans were used.

Independent review accepted these tested staging boundaries after cleanup verification. Live browser layout/chooser UX was not re-reviewed. At that staging handoff, production had not yet received the isolation release; the later production section below supersedes that checkpoint. Onboarding remains disabled. Do not run the old foundation-only verification script now: it intentionally expects the pre-migration staging schema.

## Production promotion: November 4, 2026

The user authorized production promotion and privately configured its database password. The production session-pooler host was verified as `aws-0-us-west-2.pooler.supabase.com`; it differs from staging. Private backups include a public-schema/data archive plus a 16-table public-record snapshot and two receipt originals. These do not establish managed Auth, role or complete storage recovery.

The generated production rollback rehearsal passed. Source/manifest review confirmed the production release body matches its rehearsal except comments and transaction completion. The reviewed foundation/isolation/membership transaction committed; no platform-administrator bootstrap or onboarding SQL was included. Production workspace mode was saved for the Production environment, and main was fast-forwarded to `d839a7e`. Vercel deployment `3mQeWRVMcTvmMjwpbisktXTTA9d8` reported Ready.

Post-release checks passed for isolated Ahaa ownership, zero production platform grants, workspace RPC visibility, a private receipt bucket, effective workspace API behavior, anonymous denial, no-index and production/platform route separation. Rollback-only authenticated database-role checks verified existing identities retain their role/branch, dashboard or employee inventory access, and foreign-workspace rejection. These simulated database identities do not constitute managed-Auth sign-in tests.

The user then signed in to production as admin. Browser smoke checks loaded the dashboard, daily stock, orders and invoice list; authenticated invoice download returned a 4,538-byte `%PDF-` file. The empty admin vendor list matched the zero active admin-owned receipts (branch receipts remain separately scoped). The public production bundle referenced only the production Supabase project. No production order, pickup, invoice, file or Auth mutation was used for acceptance; the full mutable two-business workflow was exercised only in staging. The existing basic platform dashboard stays staging-backed at its separate Vercel URL. Add business and onboarding remain disabled.
