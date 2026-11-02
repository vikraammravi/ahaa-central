# Vendor documents module

Phase 1 of the SaaS modularization plan. No database migrations or permission changes.

## Ownership and dependencies

- `src/features/vendor-documents/domain.ts`: shared receipt shapes, extraction, validation and filters. No credentials or database imports.
- `src/features/vendor-documents/api.ts`: browser HTTP transport with existing error and no-store behaviour.
- `src/features/vendor-documents/components`: shared admin/manager UI with colocated tests.
- `src/server/modules/vendor-documents/access.ts`: authenticated role/location checks, scope filters, safe response fields and error mapping.
- `src/server/modules/vendor-documents/collection.ts`: list/upload orchestration, duplicate restoration, database reservation and file persistence.
- `src/server/modules/vendor-documents/document.ts`: review, original-file access, scan reservation/polling and soft deletion.
- `src/server/infrastructure/azure-document-intelligence.ts`: scanner configuration, authenticated HTTP calls, timeouts, redirect restrictions and operation URL validation.

Role pages compose the shared frontend feature. Both `/api/receipts` and the existing `/api/admin/receipts` endpoint families delegate to the same server handlers. Neither endpoint family imports the other. API handlers retain their Node.js runtime declarations.

Frontend feature code cannot import server modules or privileged Supabase clients; ESLint enforces this boundary. Server modules and the scanner adapter use Next.js's server-only marker. Vitest aliases that build-time marker to a test-only empty module; production protection remains intact.

## Preserved contracts

Existing URLs, HTTP methods, response shapes/statuses, 4 MB file validation, scope isolation, original signed URL lifetime, duplicate handling, soft deletion and draft/completed UI remain unchanged. Scan reservation remains a database operation before any scan submission. Limits remain 10 scans/user/day and 100/environment/month, with two pages per submission. No live Azure calls are needed for automated tests.

The handlers still own feature database queries. A new generic repository layer is deliberately deferred until a concrete reuse need appears. These modules are not a separate backend deployment, and this change does not introduce multi-tenancy or superadmin permissions.

## Next slice

Catering is the next feature to isolate. Business isolation must be designed and verified before introducing superadmin. Do not combine mechanical moves with customer access-policy changes.

## Verification

37 Node unit tests and 240 Vitest tests (78 files) passed. The full Vitest run completed with one worker after parallel runs stalled. Focused lint, TypeScript and the production webpack build passed. Existing responsive component tests remain in coverage after their move. New adapter tests check the disabled flag, untrusted polling URLs and preserved two-page request limit. No live scan, database update or deployment was performed.
