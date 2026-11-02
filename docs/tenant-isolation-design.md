# Business isolation and platform administration

## Verified staging inventory

The read-only audit on Ahaa-Staging (`rvldwakcwxbnqyuttzkn`) found 16 business tables, 45 public functions (30 security-definer), 23 row-security policies, 32 foreign keys, no public views, and one private purchase-receipts bucket. Full metadata is stored privately outside Git. The repeatable audit is `supabase/operations/tenant_readiness_audit.sql`.

Current authorization is appropriate to one Ahaa organization with multiple branches. It is not business isolation. In particular, central-admin checks apply across the current organization's records, category/unit names are globally unique, and receipt service-role queries currently distinguish admin versus branch location, not separate businesses.

## Additive foundation

`202611020001_business_foundation.sql` introduces four purpose-specific tables:

- businesses: identity, provisioning state and supported configuration; isolation_ready defaults to false.
- business_memberships: a user's role/status/location within a business. The composite primary key permits membership in multiple businesses.
- platform_administrators: explicit platform permission, separate from CENTRAL_ADMIN.
- platform_audit_log: append-only from client perspective, recording platform entity changes and authenticated actor identity.

Existing profiles are copied into memberships for Ahaa without changing auth users, passwords or legacy operational records. No existing business admin is automatically promoted. No operational authorization helper is replaced in this foundation. Creating these tables does not enable a second customer, enforce suspension of legacy operations or make any existing data tenant-safe.

The migration and foundation assertions passed in one staging transaction that ended in ROLLBACK. After explicit user approval, the foundation and the staging-only bootstrap were installed together in one transaction. Only the active staging admin@aahatrulysouth.com account was granted platform access. Real-login checks passed for admin, manager, employee and anonymous access. Production has no foundation tables. The bootstrap remains an operations script, not an automatic migration or authorization to promote production accounts.

The foundation was applied through SQL Editor; reconcile its migration history before adopting automated CLI migration deployment. Do not replay a non-idempotent CREATE TABLE migration into staging.

Unfinished operational-isolation SQL and assertions are stored in `supabase/planned/*.draft.sql`, not in migrations or runnable test discovery. An initial rollback-only staging rehearsal passed, including scoped receipt function replacements, metadata/data-preservation checks and original fulfillment regressions. They deliberately revoke legacy receipt functions and must not be applied before workspace-aware routing, membership management and the full API/function/storage acceptance matrix are complete. See business-isolation-progress.md for the tested scope and remaining work.

Do not enable platform onboarding or claim tenant isolation until the following cutover is implemented and tested.

## Required isolation cutover

1. Resolve workspace identity from an authenticated membership. Treat the selected business ID as untrusted and reject inactive memberships and suspended businesses. Apply the same resolver to browser queries, server endpoints and jobs.
2. Add business_id to operational roots and children, backfill existing Ahaa rows, validate totals and ownership, then enforce NOT NULL, indexes and composite foreign keys. Parent/child references must carry the same business ID, including order/item, invoice/order, pickup/order-line and count/item relationships.
3. Scope category/unit names and duplicate file hashes to business. Preserve existing archived-name restoration semantics.
4. Replace global profile-role assumptions with membership role/location in current-role helpers, UI profile loading, user lists and account management. Keep identity information separate from per-business assignments. Removing one membership must not delete an auth user still belonging to another business.
5. Review all 45 functions. Security-definer functions must explicitly authorize business context and every referenced record; RLS alone does not scope functions owned by a bypass role. Retain atomic stock/invoice/pickup updates. Do not mechanically change function ownership without verifying trigger behaviour and grants.
6. Add business-scoped row-security enforcement to every operational table and review trigger side effects. Verify direct Data API calls as well as RPCs.
7. Scope privileged vendor-document routes, storage paths, original-file signing, duplicate lookup and scan reservations by business. Preserve the global environment scan ceiling even when per-business usage is tracked.
8. Include workspace identity in caches, request cancellation and editor invalidation. Changing businesses must discard or explicitly confirm unsaved work and prevent stale responses from the prior workspace.
9. Introduce module flags only for supported features and enforce them on server/database entry points where relevant. Branding and terminology are presentation configuration; tax and stock rules require explicit validated contracts.

## Required staging acceptance matrix

- Two businesses, each with an admin, manager and employee; one user with membership in both businesses.
- Foreign IDs denied for reads, writes, delete, combining, pickup, invoice PDF and original files.
- Cross-business parent/child references fail at the database layer, including privileged service paths.
- A membership role is not inherited from the user's other business.
- Inactive membership and suspended business reject operations through direct queries, APIs and RPCs.
- Existing Ahaa Ready stock deduction, pickup approvals, inventory balances and published invoice snapshots remain unchanged.
- No runtime request gets an automatic default to another business after access is revoked.
- Verify role/user cleanup and rollback with two-tenant data present. A pre-isolation UI/server rollback must not bypass new database safeguards.

## Minimal superadmin after isolation

Implement a separate protected route and server module for business onboarding, initial-owner invitation, supported module/branding settings and usage. Explicit platform permission is required; customer admin roles are insufficient. Platform configuration access does not automatically grant browsing of customer invoices/orders/files. Support access, if later needed, must be scoped, time-limited and audited.

Use existing UI primitives, responsive cards/tables and dialogs. Do not fork the existing application per customer. Independent app/API deployments remain a later extraction of these boundaries, not a prerequisite for business security.

## References

- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL policy composition](https://www.postgresql.org/docs/16/sql-createpolicy.html)
