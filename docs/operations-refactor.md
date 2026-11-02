# Operations refactor

Feature branch: codex/operations-refactor. Released to staging and production after verification.

## Data model

Keep the existing 16 business tables. Parent/line tables store orders, pickup approvals and daily inventory. Invoice edit history and published snapshots preserve what changed and what was sent. This refactor adds two functions and no tables, columns or indexes.

## Compatibility and rollout

Apply supabase/migrations/202611010005_operations_refactor.sql before deploying the new UI. It is additive and has been applied to staging and production. Existing functions and tables are retained; no business records are rewritten by this migration.

- save_order_fulfillment: active central admins only; locks the order and its lines; accepts only Submitted/Preparing orders; checks expected previous quantities/notes; updates the batch in one transaction. It does not advance status or deduct stock. Existing Ready triggers still handle stock.
- branch_dashboard_summary: active branch managers only, scoped to their assigned branch; full counts are computed in Postgres, while recent order/catering lists return at most five rows each. Uses Toronto business-day boundaries, including DST. The visible dashboard rules remain unchanged.

After the database migration, deploy to staging and review admin preparation, pickup, branch dashboard, sign-in/sign-out, inventory editing and vendor-invoice filters. Promote only after verification. Rolling back the UI is compatible with these additive functions; do not remove functions while the new UI is deployed.

## Shared UI and request handling

Protected role layouts share CurrentUserProvider so shells and pages do not independently load the same profile. Sign-out/account changes invalidate in-flight responses and reset user-scoped component state. Same-user auth refreshes and profile reloads retain forms and unsaved edits. Standalone hook consumers remain supported.

Vendor invoices now use useAsyncData for cancellation, stale-response protection and shared error/loading state. Its optimistic mutation callback keeps new upload drafts visible immediately. Existing consumers retain default focus/poll behavior; invoice focus refresh is explicitly disabled to retain its prior behavior.

Order fulfillment persistence is in a focused data module rather than embedded per-line requests in the view. Formulas and role checks remain enforced on the database side.

## Validation

The full run passed 37 unit checks plus 237 Vitest tests. Additional focused tests cover shared-profile request deduplication, same-user form preservation, sign-out during a pending fetch, stale query responses, and atomic fulfillment error handling. TypeScript, focused lint and a production build passed.

supabase/tests/operations_refactor.sql ran successfully in staging and rolled back every fixture. It verifies all-or-nothing save failure, stale edits, zero fulfillment, unchanged stock deduction on Ready, dashboard row bounds/counts/timezone/scope and role guards. Fixture order numbers are explicit, so the order-number sequence is not advanced. Separate real-login RPC checks confirmed manager scope and employee/anonymous denial without changing records.

No performance timing claims are made: the structural improvement is bounded browser payloads and shared requests. Measure database execution plans on representative volume before adding indexes or rewriting the branch-stock SQL loop.
