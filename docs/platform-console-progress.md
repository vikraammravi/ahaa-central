# Platform console checkpoint

Ahaa is a customer business. Platform authorization is a separate explicit grant, not a customer role. The current staging admin identity has both permissions for testing; this does not make every business administrator a platform administrator.

## Implemented

- `/superadmin` has independent verified-session and platform-role checks in both the route proxy and server page.
- `/api/platform/businesses` repeats authorization for every request, uses the authenticated database client, reads bounded registry metadata only and disables response caching.
- Responsive business directory and reusable shadcn registration dialog. No customer orders, invoices or stock are exposed by the console.
- Registration creates only a provisioning business with isolation readiness false. Caller-provided status, readiness or privilege fields are never forwarded.
- Database registration draft checks platform permission again, validates the name/address, enforces address uniqueness and uses the existing audit trigger. No new tables.
- `PLATFORM_CONSOLE_ENABLED=true` is server-only and defaults off. Do not enable it in production during staging work.

## Not released

`supabase/planned/platform_console.draft.sql` is not installed. Existing operational isolation drafts remain unapplied. New business registration does not assign owners, send invitations, create business records or activate access. This is the platform directory/registration step, not completed SaaS onboarding.

Next: rehearse the platform function with unauthorized/authorized users and audit assertions; finish cross-business acceptance, owner provisioning and activation checks; deploy the paired release to staging; then verify real browser flows. Production remains excluded.

## Local verification

21 focused tests passed across the console UI, platform API, proxy authorization and existing login flows. TypeScript, scoped ESLint and module boundaries passed. The 37 Node unit tests passed; the full Vitest run stalled before reporting results and was stopped, so no full-suite pass is claimed. The combined rollback-only SQL rehearsal now includes platform registration permission/audit/duplicate checks, but that revised SQL has not been executed. Browser layout review is pending staging installation.

## Routes

Platform entry is `/superadmin`; sign-in preserves that destination. Customer entry remains `/workspaces` and the existing role routes. Slugs identify businesses but do not yet create customer-specific URLs or domains. A future URL selector must resolve authenticated membership before any business request; changing a slug alone must never grant access.
