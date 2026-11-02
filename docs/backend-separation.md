# Business and platform backend boundaries

The separation is at code/module and request authorization level. It does not introduce a separate Node service, independent backend builds or completed tenant database isolation.

```text
src/server/
  business/
    http.ts                       shared business deployment guard
    users/                        legacy and membership-aware account operations
    billing/                      invoice loading and PDF generation
    vendor-documents/             receipts, files and scan orchestration
  platform/                       platform permission and business registry operations
  infrastructure/                 Azure provider integration
```

Each business feature has an `endpoints.ts` API entrypoint. Thin Next.js routes import only the relevant feature's guarded endpoints. Receipt legacy aliases and current URLs reuse the same entrypoints. Customer account dispatch keeps existing behavior while workspace mode is off and uses membership-aware operations only when that flag is enabled.

The shared business guard rejects every business API operation on the platform deployment before calling its handler. Platform page/API authorization checks its own deployment, verified user and explicit platform permission. Proxy also rejects cross-surface routes. Neither a platform role nor a deployment flag grants customer membership.

Feature-local entrypoints avoid one global backend barrel that would pull the PDF renderer and receipt integrations into account routes. Provider-specific code stays in infrastructure. Platform and business backends cannot import each other; infrastructure cannot import either. `npm run test:boundaries` enforces these directions and rejects business API imports that bypass guarded feature entrypoints.

Tests remain next to the code they cover; shared test data stays under tests/mocks. New entrypoint regressions cover all exposed business operations denied on the platform, legacy versus workspace account dispatch, and preservation of receipt request context/errors.

## Existing backend responsibilities that stay in Supabase

Orders, catalog, catering, inventory and dashboard access still use existing authenticated Supabase queries/functions. Atomic fulfillment, pickup, stock deduction and billing transactions are not moved into separate API calls. This change does not move all browser data access behind a new HTTP backend, change policies or apply migrations.

Operational multi-business SQL and membership drafts are still a separate unreleased step. Do not activate another business before cross-business query, function, service-role and file acceptance is complete. Future feature variations should be explicit business configuration or focused policies rather than customer-name conditionals spread through shared modules.

## Verification and release scope

37 Node unit tests and 50 focused backend/provider/proxy tests passed. TypeScript, scoped lint, the boundary check and diff whitespace checks passed. No production deployment, hosted settings, credentials or database records are changed by this refactor.

The earlier full UI suite is not rerun for this server-only move; its previous stalled run must not be represented as a full-suite pass. The production build is checked after the move to validate every route import.
