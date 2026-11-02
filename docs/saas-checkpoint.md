# SaaS checkpoint — November 2, 2026

## Completed

- Feature isolation: vendor documents, catering, catalog, locations, inventory, orders, billing, users and dashboards.
- Thin role pages and HTTP routes; shared UI retained; server-only PDF, user administration and scanner modules.
- Automated dependency-boundary check added to CI; colocated tests and separate mocks preserved.
- Verified 37 Node unit tests plus 240 Vitest tests, TypeScript, lint, boundary checks and production webpack build.
- Staging-only business foundation installed with explicit approval: businesses, business_memberships, platform_administrators and platform_audit_log.
- Existing staging profiles copied into Ahaa memberships. Staging admin@aahatrulysouth.com explicitly granted platform access; passwords unchanged.
- Real-login checks: manager/employee membership scope, platform audit denial, browser direct-write denial and anonymous denial passed.

## Production and deployments

Production and staging deployment branches both remain at 47d2d94. The feature refactor has not been pushed to either deployment branch. Both public sites responded HTTP 200 with no-index headers at wrap-up. Read-only database verification confirmed production has no business-foundation tables.

The staging foundation contains only Ahaa, with isolation_ready=false. Staging locations have no business_id column, confirming the operational isolation draft was not installed. No second business has been enabled. Local development servers were not started.

## Incomplete — do not release as multi-tenant SaaS

- Operational tenant isolation, workspace selection and membership-aware user management.
- Scoped privileged receipt paths/functions and storage access under business context.
- Superadmin UI, business onboarding, supported configuration and usage screens.
- Independent applications/API deployments (conditional later phase).

Draft isolation SQL and proposed tests are preserved in supabase/planned and explicitly marked incomplete/unvalidated. They must not be applied or moved into the migration pipeline as-is. The drafts revoke legacy receipt functions without implementing replacements; operational compatibility and all elevated-function paths still require review.

## Resume sequence

1. Review docs/tenant-isolation-design.md against the saved staging access inventory.
2. Complete workspace contracts, identity/role projection, scoped server paths and business-aware database functions together.
3. Rehearse the complete migration in a rollback-only staging transaction, including unchanged Ahaa workflows and two-business rejection tests.
4. Install staging isolation only after acceptance checks; then build and verify superadmin. Do not activate another business before both application and database boundaries are verified.
5. Deploy to staging and review before requesting any production promotion. Keep foundation migration history consistent with its manual staging application.
