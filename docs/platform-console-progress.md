# Platform console checkpoint

Phase 1 onboarding (November 20, 2026, branch `codex/platform-onboarding`, not installed or deployed): pool model (shared database separated by `business_id`). Flow: register (provisioning) → invite first admin with a one-time 24-hour copy-link (or assign an existing active account; invites reject emails that already have an account) → admin accepts at `/accept-invite` on the business app → platform activates. The console shows each business's setup progress and latest invitation (pending with expiry, expired, needs review, revoked, accepted), with reissue and revoke. The temporary-password owner path and `PLATFORM_NEW_OWNER_CREATION_ENABLED` were removed. The accept handler lives in `src/server/business/onboarding` (module boundaries pass). All SQL is in `supabase/migrations/202611200002_platform_onboarding.sql` plus follow-up `202611200003_platform_onboarding_resolve_guard.sql` (the old `platform_console` and separate drafts were deleted); `node scripts/prepare-platform-onboarding-rehearsal.mjs` builds a rollback-only staging rehearsal with its four SQL tests. That rehearsal passed on staging. It exposed six catalog option column grants (INSERT(name), UPDATE(name,is_active) on `catalog_categories`/`catalog_units`) missing on staging but present in production; they were restored on staging the same day with `supabase/operations/restore_staging_catalog_option_grants.sql`, after which signed-in privileges matched production exactly. Both migrations were installed on staging on November 20, 2026 after a staging schema backup; read-only checks confirmed claim/complete/release are service-role only, the other platform functions require platform access, nothing is granted to anonymous users and the invitation tables have RLS with no direct client access. Production has neither migration. Hosted flags remain off.

Current release status (November 4, 2026): the basic dashboard remains on its separate staging-backed Vercel deployment. Business isolation and workspace membership changes are now installed in staging and production; see `business-isolation-progress.md`. Platform registration/owner/onboarding drafts remain unapplied and their flags disabled. This supersedes older statements below that operational isolation was not installed.

Ahaa is a customer business. Platform authorization is a separate explicit grant, not a customer role. The current staging admin identity has both permissions for testing; this does not make every business administrator a platform administrator.

## Implemented

- `/superadmin` has independent verified-session and platform-role checks in both the route proxy and server page.
- `/api/platform/businesses` repeats authorization for every request, uses the authenticated database client, reads bounded registry metadata only and disables response caching. No customer orders, invoices or stock are exposed by the console.
- Registration creates only a provisioning business with isolation readiness false. Caller-provided status, readiness or privilege fields are never forwarded.
- First admin, two ways (Phase 1 package): a one-time invitation link (default) or assignment of an existing active account. Invitations store only a SHA-256 hash; the link is shown once and carries the token in the URL fragment. Issuing rejects an email that already has a login (use existing-account assignment). Existing-account assignment refuses while an invitation is being redeemed and revokes any unused link.
- Redemption (`/accept-invite` on the business app, service-only database functions) claims the invitation, creates the login with the invitee's own password and records the CENTRAL_ADMIN membership. A definite Auth rejection (4xx, e.g. weak password) releases the claim so the same link can be retried; any uncertain outcome keeps the invitation held as "interrupted". The platform's **Resolve** action then finishes the setup if the login exists (pending, no memberships) or cancels the invitation so a new link can be issued. Completion does not re-check the 24-hour expiry once claimed.
- Invitation management: the console shows each business's setup progress and latest invitation (pending with expiry, expired, interrupted, revoked, accepted) with Reissue (replaces the unused link), Revoke and Resolve. The status summary is bounded to the listed businesses. If status cannot be loaded, admin setup is paused rather than risk replacing a shared link.
- Activation requires exactly one active admin and the isolation checks; afterwards the console links to `/b/<slug>`.
- Flags are server-only and default off: `PLATFORM_CONSOLE_ENABLED`, `PLATFORM_BUSINESS_REGISTRATION_ENABLED`, `PLATFORM_OWNER_ASSIGNMENT_ENABLED`, `PLATFORM_OWNER_INVITATIONS_ENABLED`, `PLATFORM_BUSINESS_ACTIVATION_ENABLED` (platform) and `BUSINESS_OWNER_ACCEPTANCE_ENABLED` (business, with workspace mode). The console also requires `APP_SURFACE=platform`. The temporary-password path and `PLATFORM_NEW_OWNER_CREATION_ENABLED` were removed.

### Accepted risks

- No email is sent, so the invitee's email is not verified: whoever holds the link creates a confirmed login for that address and becomes the business admin. Share links privately; reissue or revoke if a link may have leaked. Email delivery is a later improvement.
- Redemption has a shared ceiling of 600 claims per minute plus 5 attempts per minute per link. Anonymous traffic can exhaust the shared ceiling for up to a minute (nothing is consumed). An edge or per-IP limit is a later improvement.

## Not released

The onboarding migrations are installed on staging only (not production); hosted flags are off. A live two-business HTTP/browser acceptance, the production console deployment and email delivery are pending. Earlier entries below are historical.

## Local verification

21 focused tests passed across the console UI, platform API, proxy authorization and existing login flows. TypeScript, scoped ESLint and module boundaries passed. The 37 Node unit tests passed; the full Vitest run stalled before reporting results and was stopped, so no full-suite pass is claimed. The combined rollback-only SQL rehearsal now includes platform registration permission/audit/duplicate checks, but that revised SQL has not been executed. Browser layout review is pending staging installation.

The subsequent local preview passed 23 focused tests, TypeScript and scoped lint. A real staging platform login was verified through the local sign-in screen to `/superadmin`; the dashboard loaded the existing Ahaa registry entry. Only the local development process enables the console, with registration disabled. No hosted flags, business records or database permissions were changed. Local browser proof is saved outside Git as `superadmin-starting-dashboard.png`.

## Routes

Platform entry is `/superadmin`; sign-in preserves that destination. With workspace mode enabled, `/b/<slug>` provides an authenticated business-entry link and verifies membership before selecting the workspace. The role routes and workspace chooser remain shared. This is not a custom-domain binding or hostname isolation.
