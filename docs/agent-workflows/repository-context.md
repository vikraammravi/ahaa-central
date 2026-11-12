# Ahaa repository context for delivery agents

Read this at the start of Ahaa feature and bug work. Resolve paths from the repository root. Run `node scripts/index-agent-context.mjs` for a current, credential-free file index, then search the relevant paths with `rg`. The index identifies files; it does not analyze behavior, prove authorization or describe deployments. Read the implementations and callers before editing.

## Module ownership

- `src/app`: thin role pages and HTTP routes. Business API routes delegate to guarded `src/server/business/<feature>/endpoints.ts` modules.
- `src/features/{catalog,catering,locations,inventory,orders,billing,users,dashboard,vendor-documents,workspaces,platform}`: domain rules, data contracts, screens and feature components. Discover actual directories through the index.
- `src/components/ui`: shadcn primitives; `src/components/shared`: reusable product components. Admin/branch/employee components own role shells.
- `src/server/business/{users,billing,vendor-documents}`: customer server operations. `src/server/platform`: platform operations. `src/server/infrastructure`: external providers. Keep these dependency directions as enforced by `scripts/check-module-boundaries.mjs`.
- `src/lib`: shared session/authentication, Supabase clients/types, dates, currency, pagination and navigation guards. Browser modules must not import privileged database clients.
- Supabase functions and triggers implement atomic ordering, fulfillment, stock, pickup and billing workflows. Do not replace a transaction with independent browser writes.
- Tests live beside their implementations; shared data/mocks live in `tests/mocks`. jsdom component tests cannot establish responsive layout or live database isolation.

Read `docs/module-structure.md`, `docs/backend-separation.md` and `tests/README.md` for affected work. Read the relevant guide under `node_modules/next/dist/docs/` before writing Next.js code, as required by `AGENTS.md`.

## Business invariants to verify when affected

- Admin, branch manager and branch employee have distinct permissions. Employees manage their branch inventory and catering; ordering and branch invoices require manager permissions.
- Central stock is deducted when an order becomes Ready. Completed pickup and deviations use existing atomic fulfillment/approval rules; increased and reduced pickup need approval.
- Branch inventory uses whole units. Used = Opening + Received - Wasted - Closing. Wasted and Closing are editable; Used is derived. Confirm current received-stock implementation before changing pickup/inventory integration.
- Individual invoices support review/editing; combining eligibility requires completed, settled, unbilled orders. Published combined-invoice amounts are snapshots. Do not silently rewrite previously published financial data.
- Catalog history uses archival/soft deletion where prior records reference an item; category/unit archival and duplicate-name behavior must retain references.
- Vendor files are private. User roles, business/branch scope, original-file signing, duplicate restoration and scan reservation must be checked in server/database paths. Existing scan ceilings are 10/user/day and 100/environment/month, not an Azure billing guarantee. Do not run paid scans as ordinary tests.
- Reuse existing shadcn dialogs/buttons, blur overlays, consistent actions, unsaved-edit guards and date/tax formatting. Test mobile/tablet cards and desktop tables where affected. Branch mobile/tablet navigation differs from admin.

## Release checkpoint: November 4, 2026

This is a historical checkpoint, not evidence of the current hosted state. Verify it before external changes.

- Business production: `https://www.aahastore.com`; Supabase project `znfedioxsrvvjtfnpszw`.
- Business staging: `https://staging.aahastore.com`; separate Supabase project `rvldwakcwxbnqyuttzkn`.
- Platform dashboard: `https://operations-platform-admin.vercel.app/superadmin`, backed by staging. `APP_SURFACE` separates business/platform routes in deployments of one app; these are not independent compiled microfrontends.
- Both `main` and `staging` received `e9bafb8`. Those latest changes were assertions/docs, not installation of business isolation. A prior deployment of `33a835d` was verified Ready; recheck later deployment status rather than assuming success from Git.
- Staging has the four business/membership/platform foundation tables. Production lacks that SaaS foundation. Operational isolation and workspace membership SQL in `supabase/planned` remain uninstalled. Registration and owner setup are disabled. Activation and full onboarding are incomplete.
- Rollback SQL rehearsals passed, but real two-business HTTP/file/browser acceptance and the coordinated staging cutover remain unfinished. Never equate a rollback rehearsal with an installed migration.
- The isolation draft revokes legacy receipt RPCs; the deployed workspace-disabled app calls those RPCs. Database changes and the workspace-enabled app require a coordinated release. Switching only one side breaks vendor invoices or fails closed.
- Private backups cover public schema/application data and some files. Local recovery checks used placeholder Auth objects and disabled constraints; a full managed Supabase recovery has not been proven. Never claim an Auth-password/storage recovery test from those artifacts.

For SaaS work, read `docs/tenant-isolation-design.md`, `docs/business-isolation-progress.md`, `docs/workspace-membership-progress.md` and `docs/platform-console-progress.md`. Build on the modular monolith; add abstractions for demonstrated reuse. Do not introduce a new service or framework for an ordinary feature.

## Verification and release evidence

Staging operations update, November 12, 2026: the `staging` branch received the pickup-date, branch usage history, combined-invoice and catering changes. Staging database has migrations `202611050001`–`202611050006`, with the checked invoice-preview RPC installed before the app and the legacy pickup RPC revoked after deployment. A staging public-schema/data backup was saved; it does not include Auth or Storage. Rollback database tests passed, as did 382 Vitest tests, 37 Node tests, lint, module boundaries, and the webpack production build. Read-only staging checks verified a branch login, workspace, catering filters and inventory history, plus admin receipt API and individual invoice PDF. This is not a full live order-to-invoice mutation test. The older unchecked invoice-combination RPC remains available to older clients for compatibility. Production was not promoted with these changes; its matching migrations require a coordinated release. Recheck hosted state before future changes.

Production promotion checkpoint: production now also has the reviewed foundation/isolation/membership package and effective workspace mode. Its rollback rehearsal and commit passed; `main` was promoted to `d839a7e` and Vercel production deployment `3mQeWRVMcTvmMjwpbisktXTTA9d8` is Ready. Existing role/branch membership and authenticated DB-role access checks passed. The user signed in as admin; production dashboard/stock/orders/invoice lists loaded and invoice PDF download succeeded. Production endpoint selection, no-index, private bucket, anonymous denial and `/superadmin` rejection passed. No production platform grants or onboarding were enabled. The platform Vercel dashboard remains staging-backed. Do not replay foundation/isolation migrations or run pre-isolation assertions. Real multi-business mutation acceptance was done in staging; production received read-only/smoke checks, not a full order-to-invoice mutation test. See the newer production section in `docs/business-isolation-progress.md` for evidence and backup limitations.

Earlier staging cutover checkpoint: `d839a7e` and the isolation/membership package were installed in staging. Workspace-enabled deployment `CebTfC1BHEvfdqrLrpxDW39FPsGq` is Ready. Live two-business acceptance passed 17 scenario groups covering actual PDF/private-file access, roles, foreign IDs and revoked access. Setup exercised Ready deduction, pickup completion, combining and sending; generated rows/files/memberships were cleaned up, and Ahaa role/platform-directory checks passed afterward. Independent review accepted these tested staging boundaries. Browser layout/chooser UX was not re-reviewed. The later production checkpoint above supersedes the former staging-only status. Keep onboarding disabled; do not run foundation-only assertions or replay installed migrations.

Use focused tests first; run boundaries, TypeScript, lint, wider regression and a build as justified by the change. Current commands: `npm run test:unit`, `npx vitest run <paths>`, `npm run test:boundaries`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. If the local runner stalls, diagnose worker/process permissions; single-worker Vitest outside a restricted execution environment previously worked. `npx next build --webpack` previously passed when Turbopack failed; disclose the exact builder and network/font limitations. Do not label an interrupted run passed.

Git pushes, Vercel builds, environment variables and database migrations are separate release events. Record each explicitly. Skills do not authorize new emails, paid provider calls, permission grants, destructive resets or production mutations beyond the user's actual request. Keep credentials, `.env*`, private backups and unrelated report files out of commits.

## Hosted scanner checkpoint: November 5, 2026

Hosted AI scanning is now enabled in Production and only the staging Preview branch after approved Azure network change to All networks (key authentication/server-only key retained, resource Free F0). Staging9rchm2BiW7zZkTkuRfJwfW2GbjvY and production2ddBTgBAMgSRTAgFTcQSuWBCwvRJ Ready at9ec7f48. Synthetic hosted scans passed extraction/review/save in both; staging additionally verified reopen, private PDF bytes and duplicate usage preservation. Both fixtures archived with counters/originals retained. Live read-only quota checks enforce10/user/day +100/environment/month; stage3→4/prod0→1 attempts. Production original redirect worked but browser download timed out, so do not claim its bytes verified. No scanner source changes or migrations. See docs/purchase-receipts.md; older hosted-AI-disabled checkpoints are historical.
