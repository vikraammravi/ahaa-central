# Application module ownership

## Current structure

Business and platform use separate configured deployments of the same Next.js application. Role routes in `src/app` compose features; API routes delegate to their backend namespaces. Database functions remain the authoritative implementation of existing transactional workflows. See backend-separation.md for the current code boundaries and remaining database work.

| Feature | Frontend ownership | Server/database ownership |
| --- | --- | --- |
| Catering | features/catering | Existing scoped catering queries and functions |
| Catalog | features/catalog | Existing catalog and category/unit functions and guards |
| Locations | features/locations | Existing location policies and constraints |
| Inventory | features/inventory | Existing stock/day-count functions and triggers |
| Orders | features/orders | Atomic order, fulfillment and pickup functions |
| Billing | features/billing | server/business/billing and existing invoice functions |
| Users | features/users | server/business/users and existing profile access guards |
| Dashboards | features/dashboard | Existing bounded dashboard summary functions |
| Vendor documents | features/vendor-documents | server/business/vendor-documents and server/infrastructure/Azure |
| Platform | features/platform | server/platform, explicit platform permission and registry functions |

`components/ui` and `components/shared` own reusable visual building blocks. Role shells stay in `components/admin`, `components/branch` and `components/employee`. Shared authentication/session loading, database clients/types, formatting, dates, pagination, request cancellation and navigation guards stay in `lib`.

## Dependencies

- Features may reuse another feature's public types, pure rules or UI where workflows compose (for example branch orders with combined invoices).
- Features never import server implementations or privileged clients. Server modules never import route implementations.
- API routes never import one another. Both legacy and current vendor-document URLs point to the same server module.
- Business API routes use each feature's guarded `endpoints.ts`. These reject the platform deployment before business operations run. Platform authorization independently rejects business deployments.
- Business and platform backend namespaces cannot import one another. Infrastructure cannot depend on either namespace; the dependency checker enforces these rules.
- PDF rendering and privileged invoice data loading are server-owned; the browser only shares the PDF URL/data contract.
- No generic repositories, empty service folders or speculative microservices were introduced. Browser queries remain behind existing database authorization; file organization is separate from changing access paths.
- Orders, pickup, stock deduction and billing are still coordinated by existing database transactions/triggers. Do not replace those transactions with independent browser requests.

Run `npm run test:boundaries` to check production-source import directions. CI runs it alongside existing tests. Feature tests stay next to their implementations, and shared fixtures remain in `tests/mocks`. Coverage includes the relocated screens, components and hooks.

## SaaS work still separate

These boundaries do not make the app multi-tenant. Business memberships, tenant-owned rows, cross-business reference prevention, server-role scoping, file isolation and RPC authorization must be implemented and verified before a second business is activated or platform administration gains customer access.

## Verification

The complete refactor passed 37 Node unit tests and 240 Vitest tests across 78 files, including existing responsive scenarios. TypeScript, full source/test/script lint, the dependency-boundary check and the production webpack build passed. All existing routes were preserved. No deployment or operational database change was included.
