# Workspace selection and membership-management step

Branch: codex/saas-onboarding. Workspace mode stays disabled and production is unchanged.

## Implemented

- `/workspaces` is a flag-gated chooser using authorized memberships. Existing admin, manager and employee URLs stay unchanged.
- `/b/<slug>` is a flag-gated entry link that checks the signed-in user's authorized memberships before selecting a business. It does not bind access to a hostname.
- Login and proxy guards resolve the selected membership role; missing/revoked/ambiguous context goes to the chooser while retaining the verified login. Invalid selections can be recovered there.
- My Profile links to the chooser in workspace mode. Sign-out clears the selection. Different business, role or branch assignments invalidate user-scoped page state.
- Browser transport blocks writes from a stale workspace page and discards responses arriving after selection changes. Workspace-resolution responses also cannot restore an old selection after another tab switches businesses.
- New user APIs verify the acting business admin, branch ownership and input before creating an identity. The service-only assignment function accepts only a new pending identity with no existing memberships. Responses exclude passwords.
- Unknown remote assignment outcomes do not trigger Auth identity deletion. An incomplete setup may require platform review before retry; this deliberately preserves identities that might already have a valid assignment.
- User lists and role/status/location edits are membership-aware. Global identity changes on shared accounts require the identity owner. Direct profile updates cannot bypass membership permission checks.
- Removing a user removes only their membership in the selected business. The Auth login, other memberships and business history remain. The UI calls this Remove access. Single-business legacy mode retains its prior delete behavior.
- Database guards serialize business access changes and preserve at least one active admin. Active branch roles require a location in the same business.

## SQL release set

`supabase/planned/workspace_memberships.draft.sql` must be paired atomically with the isolation draft and workspace-aware application code. It enables only the existing Ahaa workspace; new businesses remain behind provisioning/isolation gates. Neither draft is installed.

The combined rollback-only staging rehearsal passed workspace choices, scoped user lists, last-admin protection, shared-identity protection, membership-only removal, forbidden global-profile changes and service assignment of a temporary Auth fixture. It also reran the existing isolation/receipt-budget and Ahaa fulfillment/Ready-stock regressions. All schema, permission and fixture changes rolled back; no password or email was issued for the temporary fixture.

## Remaining release gates

Finish the full cross-business API/storage/function acceptance matrix, then apply the verified release set to staging and enable its feature flag for authenticated browser review. Component tests cover chooser behavior, but actual browser layout and account flows still require the staged release. A separate superadmin directory exists, with first-admin assignment for an existing account implemented behind disabled flags. New-account onboarding and activation remain pending.

The database release and workspace-enabled app must be coordinated as one staging cutover. The database draft revokes the legacy receipt creation and scan functions, but the currently deployed app calls those functions while workspace mode is off. Applying the database draft on its own would break vendor-invoice uploads and scans. Conversely, enabling workspace mode before its database functions exist fails closed. Prepare a tested cutover and recovery procedure, including an explicit temporary service interruption if needed; do not enable another business during the transition. Verify receipt upload, viewing and scan-limit enforcement after both sides are active, without making an unnecessary paid scan.

There are still 16 production tables and 20 staging tables; this step adds no permanent tables. No Vercel environment settings, domains or deployed branches were changed.

## Verification

37 Node unit tests plus 275 Vitest tests passed (312 total). Full source/test/script lint, TypeScript and the dependency check passed. Production webpack builds passed with workspace mode disabled in the normal workspace and enabled in an isolated ignored build folder. The normal local environment remains disabled; no development server was started.

Final read-only verification confirmed staging still has only the approved foundation, isolation_ready=false, and no operational business_id column. Production has no SaaS foundation tables. The combined SQL release set and all Auth/data fixtures were rolled back rather than installed.
