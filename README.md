# Aaha Central

Central Kitchen operations platform for [Aaha Truly South](https://aahatrulysouth.com/) — connecting the central kitchen admin team with every branch.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **Tailwind CSS v4** + **shadcn/ui** (Radix)
- **Supabase** — Postgres, Auth, RLS
- **TypeScript**

## Two experiences, one app

- `/admin/*` — Central Admin console (desktop-first, fully responsive)
  Dashboard · Stock · Catalog · Orders · Branches · Users · Invoices
- `/branch/*` — Branch Manager app (mobile-first with desktop sidebar)
  Home · Order · Catering · Invoices · Profile

Auth is shared. Role is resolved server-side from `profiles.role`; middleware redirects each user to the correct area.

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase values
npm run dev
```

Environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
```

## Database

Schema, RLS policies, triggers and helper functions live in Supabase. See migration notes in project history — six core tables (`locations`, `profiles`, `catalog_items`, `orders`, `order_lines`, `catering_events`) with row-level security scoping every branch manager to their own location.

The migration in `supabase/migrations/202610100001_catalog_threshold_ready_stock.sql` adds per-product low-stock thresholds (default 20) and deducts saved fulfilled quantities on the first transition to Ready. Apply it in the project's Supabase SQL Editor after checking for existing inventory triggers. Submitted and Preparing orders do not reduce stock; repeated Ready updates and pickup completion do not deduct again. Existing Ready and Completed orders are treated as already accounted for. Daily Stock refreshes every five seconds and rejects saving an edited quantity if inventory changed in the meantime.

Apply `supabase/migrations/202610100002_pickup_approval.sql` next for pickup review. Matching prepared quantities complete immediately through `submit_pickup`; changed quantities require approval with an optional note and remain Ready with a pending approval badge. Admin reviews each request in a modal from the order details screen. Approval deducts extras, returns usable leftovers or marks them unavailable, updates the invoice, and completes the order in one transaction. Rejection leaves the order Ready for another request. Prepared lines are locked after Ready and direct completion is blocked so browser writes cannot bypass approval. Requests retain quantities, reasons, requester, reviewer, timestamps, and inventory adjustments. The order screens refresh every five seconds while Ready.

Run `node --test tests/pickup.test.mjs` for pickup input checks. Database integration checks are in `supabase/tests/pickup_approval.sql`; the script uses the authenticated role and rolls back all fixtures without advancing order numbers.

Apply `supabase/migrations/202610100003_invoice_delivery.sql` for in-app invoice publication. Admin invoices support inclusive start/end dates and branch filters, clickable invoice details, and an admin-only Send to Branch action after completed pickup. Sending records the timestamp and admin, disables repeat sending, and adds a View Invoice link in branch Kitchen Orders. Sent rows remain clickable and appear grey. Invoice publication is inside the app; email delivery is not configured.

Branch Kitchen Orders include each order's catalog items. Catering uses a responsive table with customer calls, name/phone search, status filters, and scrollable mobile booking forms. Invoice delivery integration checks are in `supabase/tests/invoice_delivery.sql`; run `node --test tests/*.test.mjs` for local checks.

Apply `supabase/migrations/202610100004_invoice_editing.sql` for admin invoice corrections. In invoice details, Edit Invoice supports billed quantities within the original request, unit prices, and tax (13% or -), with a required reason. Quantity corrections after stock deduction adjust inventory atomically; reductions require choosing usable returns or unavailable items. Pending pickup approvals must be reviewed first. Each edit records a revision, actor, before/after lines, reason, and stock adjustments, and rejects stale changes. A sent invoice retains its published snapshot for the branch until Send Updated Invoice publishes the correction. Database tests are in `supabase/tests/invoice_editing.sql`.

`202610100005_admin_reliability.sql` makes account-status checks part of database role/location helpers, saves Daily Stock batches atomically with conflict detection, and supplies dashboard summaries and filtered order counts. Revenue uses completed orders only, and business dates use America/Toronto. Admin orders and invoices use 25-row database pagination. Shared query/loading logic lives in `src/lib/admin/data.ts` and `src/lib/useAsyncData.ts`, including request cancellation and refresh polling that pauses in hidden tabs. Display formatting is centralized in `src/lib/format.ts`; invoice totals/history and order timelines are separate reusable components. Authentication runs through Next.js `src/proxy.ts` and rejects inactive or missing profiles. The admin shell displays the signed-in profile.

Storage types are generated from the metadata-only `supabase/schema.snapshot.json` using `node scripts/generate-database-types.mjs`; refresh the schema snapshot after database migrations. Application domain types derive from the generated rows and enums and retain existing default-value contracts. Run `node --test` for local checks and `supabase/tests/admin_reliability.sql` for rollback-only stock/access/dashboard integration checks.

The `20261011` migrations introduce combined billing and physical pickup returns. Admin Invoices has exactly two tabs: Individual Orders and Invoices. Select completed, settled, unbilled orders for one branch/date range, preview the combined items and totals, then send a single weekly invoice. Published versions are immutable snapshots; corrections are made through the individual invoice modal and published by resending the weekly invoice. Quantity and tax are editable, prices are locked, and billing corrections do not change physical pickup or stock. `202610110003_combined_invoice_only.sql` removes individual publication fields and send functions. Combining orders immediately opens the Invoices tab, where View and Send actions are available; sent rows are grey and disabled until an edit needs sending.

Pickup quantities may exceed the original request and require admin review. Notes are optional. Branches can explicitly record quantities already physically collected; extras debit available inventory once, and stock allocated elsewhere is tracked as a shortfall. Rejecting already-collected extras creates a return request. Admin confirms receipt before available inventory is credited, with allocated returns filling the shortfall rather than becoming free stock. Admin can also confirm normal pickup when the branch forgets. `supabase/tests/weekly_workflow.sql` verifies these scenarios with rollback-only fixtures. Older invoice-edit/delivery SQL tests describe the previous per-order billing behavior; use the weekly workflow test for the current billing rules.

## Design system

Component primitives live in `src/components/shared/` and are composed by page files. Anything used more than once (dialogs, tables, filters, empty states, sign out) is factored there rather than inlined.

`supabase/operations/reset_branch_orders.sql` is a one-time manual reset, separate from schema migrations. It checks the backed-up record counts, clears only order/pickup/invoice records, and preserves catalog stock, catering, locations and profiles. Do not run it during normal deployment.

Branch ordering now uses New Kitchen Order and Kitchen Orders labels. New orders are reviewed in a modal before submission; pickup quantities are edited in a modal with increase/decrease controls and polling pauses while editing. Admin approval uses one Notes field and Approve/Reject actions; approved reductions return uncollected quantities to available stock. Branch Kitchen Orders and combined Invoices use separate tabs with pagination. Admin Branch Orders is a single paginated list.
