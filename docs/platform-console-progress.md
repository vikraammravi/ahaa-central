# Platform console checkpoint

Current release status (November 4, 2026): the basic dashboard remains on its separate staging-backed Vercel deployment. Business isolation and workspace membership changes are now installed in staging and production; see `business-isolation-progress.md`. Platform registration/owner/onboarding drafts remain unapplied and their flags disabled. This supersedes older statements below that operational isolation was not installed.

Ahaa is a customer business. Platform authorization is a separate explicit grant, not a customer role. The current staging admin identity has both permissions for testing; this does not make every business administrator a platform administrator.

## Implemented

- `/superadmin` has independent verified-session and platform-role checks in both the route proxy and server page.
- `/api/platform/businesses` repeats authorization for every request, uses the authenticated database client, reads bounded registry metadata only and disables response caching.
- Responsive business directory and reusable shadcn registration dialog. No customer orders, invoices or stock are exposed by the console.
- Registration creates only a provisioning business with isolation readiness false. Caller-provided status, readiness or privilege fields are never forwarded.
- Database registration draft checks platform permission again, validates the name/address, enforces address uniqueness and uses the existing audit trigger. No new tables.
- `PLATFORM_CONSOLE_ENABLED=true` is server-only and defaults off. Do not enable it in production during staging work.
- The console also requires `APP_SURFACE=platform`. The default business deployment cannot serve platform pages/APIs. See platform-deployment.md for the separate Vercel project setup.
- Registration additionally requires server-only `PLATFORM_BUSINESS_REGISTRATION_ENABLED=true`; it defaults off in the page and API, so a read-only starting dashboard can run before the registration migration is installed.
- First-admin assignment accepts an existing active identity for a provisioning business, records a membership and audit event, and leaves the business in setup. It creates no login and sends no email. It is gated by the same disabled registration flag and the pending database function.
- A draft service-only function for assigning a newly created pending identity rechecks the platform actor, prevents assignment while active businesses lack isolation, and leaves the customer in setup. An authenticated preflight runs before the server creates a login. The combined rollback-only staging rehearsal passed permission, readiness, assignment, audit and duplicate-owner assertions. These functions are not installed.
- The first-admin dialog and server handler support either an existing active account or a new account with a temporary password. New-account creation additionally requires `PLATFORM_NEW_OWNER_CREATION_ENABLED=true` and a server-only admin key; both are unavailable in the hosted platform project. No email is sent and the business remains in setup. The temporary password is not automatically forced to change at first sign-in, so that improvement remains a release gate. If an Auth or assignment response is uncertain, the account is preserved for review rather than deleted.

## Not released

`supabase/planned/platform_console.draft.sql` is not installed. Existing operational isolation drafts remain unapplied. Account creation and existing-account assignment are implemented but disabled; invitations and business activation are not implemented. This is not completed SaaS onboarding.

The combined rollback-only staging rehearsal passed authorized and unauthorized registration and owner-assignment checks, including audit assertions. The added authenticated business-entry and onboarding tests also passed locally. Actual two-business HTTP and file-access tests, account creation, activation and the staging release are still pending; production remains unchanged.

The current onboarding branch passed 326 Vitest tests across 92 files, 37 Node unit tests, TypeScript, lint and a production webpack build. The new-account form and API are implemented behind disabled flags, but live account creation and activation have not been exercised. No customer account was created by the rehearsal.

## Local verification

21 focused tests passed across the console UI, platform API, proxy authorization and existing login flows. TypeScript, scoped ESLint and module boundaries passed. The 37 Node unit tests passed; the full Vitest run stalled before reporting results and was stopped, so no full-suite pass is claimed. The combined rollback-only SQL rehearsal now includes platform registration permission/audit/duplicate checks, but that revised SQL has not been executed. Browser layout review is pending staging installation.

The subsequent local preview passed 23 focused tests, TypeScript and scoped lint. A real staging platform login was verified through the local sign-in screen to `/superadmin`; the dashboard loaded the existing Ahaa registry entry. Only the local development process enables the console, with registration disabled. No hosted flags, business records or database permissions were changed. Local browser proof is saved outside Git as `superadmin-starting-dashboard.png`.

## Routes

Platform entry is `/superadmin`; sign-in preserves that destination. With workspace mode enabled, `/b/<slug>` provides an authenticated business-entry link and verifies membership before selecting the workspace. The role routes and workspace chooser remain shared. This is not a custom-domain binding or hostname isolation.
