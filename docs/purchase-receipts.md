# Purchases and receipts

## Hosted scanner checkpoint — November 5, 2026

Hosted AI is now enabled for Production and the `staging` Preview branch. Other Preview branches have no enable flag and fail closed. This checkpoint supersedes the disabled-scanner release notes below.

After explicit approval, the Azure scanner changed from Selected Networks to All networks; API-key authentication remains required, the key stays server-only, and the resource remains Free F0. This removes the IP restriction: possession of the Azure key would permit direct provider calls outside application quotas. The app still enforces 10 attempts/user/Toronto day and 100/environment/UTC month atomically; these are not an Azure subscription spending guarantee.

Staging deployment `9rchm2BiW7zZkTkuRfJwfW2GbjvY` and production deployment `2ddBTgBAMgSRTAgFTcQSuWBCwvRJ` are Ready at source `9ec7f48`. Staging passed a synthetic upload, scan, extraction, reviewed save/reopen, private PDF download and duplicate-counter preservation check. The approved production browser smoke test passed upload, extraction and reviewed save; opening the original reached the signed private Storage URL, but the browser download helper timed out, so production PDF bytes were not verified in that test. Both exact synthetic records were archived through the app, retaining their originals and usage. One scan was counted per environment (monthly staging 3→4, production 0→1). Existing focused mocked tests passed 14 cases; this release did not modify scanner source or install database migrations.

Admins and branch managers can upload, scan, review and save. Admin records and each branch’s records are isolated. Employees have no access. Separate from branch invoices; saving never changes inventory.

## Setup

1. Apply `supabase/migrations/202610300003_purchase_receipts.sql` once.
2. Set server-only `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` and `AZURE_DOCUMENT_INTELLIGENCE_KEY` in `.env.local` and the Vercel environment. Never prefix these with `NEXT_PUBLIC_`.
3. Set server-only `AZURE_DOCUMENT_SCANNING_ENABLED=true` only after quota migrations and the correct keys are configured. Missing/false disables AI calls (including result polling); uploads and manual entry still work.
4. Confirm the Azure resource uses Free F0. The application cannot establish the resource's billing tier from its API key.
5. Ensure the resource's endpoint/network configuration permits the application's server to connect. A 403 reporting a virtual network is an Azure configuration blocker, not an extraction failure.

One database table holds receipt details, file references, the current scan operation and usage counters. Original PDFs/photos are stored in the private `purchase-receipts` bucket. Only the authenticated, scope-checked API may upload files, edit receipt records, start scans or issue short-lived original-file links.

## Limits

- PDF/JPG/PNG, maximum 4,000,000 bytes; MIME type and file signature checked.
- At most the first two pages per scan, using Azure's 2024-11-30 prebuilt invoice or receipt API.
- Unlimited uploads and ten scan attempts per user per Toronto calendar day, 100 attempts per environment per UTC calendar month, minimum five seconds between submissions.
- Failed/rescan attempts count conservatively. No automatic POST retries. Result polling does not start another scan.
- Usage from Azure Studio or other applications sharing the resource is not visible to this application.
- Limits are reserved atomically in a service-role-only function. Client roles cannot change counters. Deletion archives the invoice using deleted_at, retains its original and scan counters, and hides it from active lists and original-file routes. Archived invoices cannot reserve new scans. Uploading the same file restores the existing record without resetting scan usage.
- When scan-capped, manual review/entry still works. Uploads have no count limit; the 4 MB per-file limit remains. Failed storage reservations count; restoring the identical file does not reset allowances.

## Review

Receipt scans are editable drafts. Missing quantities and amounts stay blank; they are not invented. Arithmetic mismatches are flagged; raw extraction-confidence messages are hidden from the review UI. Discounts, delivery charges, deposits and tips may legitimately prevent line amounts or subtotal/tax from reconciling with a total, so discrepancies are warnings and require human review rather than automatic correction.

Rescanning requires confirmation and replaces the form when finished. Saving requires vendor, date, total, valid structured fields and an explicit review confirmation. Duplicate original files open the existing record without scanning. Running scans cannot be saved over. The original remains accessible through a protected route that issues a 120-second Storage URL.

The server submits scans and stores the operation reference; the client polls results every five seconds while open. Reopening a receipt resumes result collection. This first version has no scheduled worker: if the user never reopens a running receipt, the app will not collect its result automatically. Azure results can expire; such documents may need rescanning.

## Verification

Run adjacent Vitest tests for extraction and review, TypeScript and lint. The rollback-only `supabase/tests/purchase_receipts.sql` verifies daily/global limits, overlapping requests, caller permissions and private storage without retaining fixture data. Test real documents before relying on extraction accuracy.

## Current local setup

Feature branch: codex/azure-document-scanner. Local development uses the staging Supabase project. Azure Free F0 was confirmed, and the approved local client IP was added to Selected Networks. The model connectivity check now returns 200. Hosted scanner access needs separate network configuration before deployment.

Vendor Invoices uses the shared desktop table and phone/tablet cards. Upload is a shared shadcn dialog and creates a draft in the list. Edit opens scanning/review; icon actions open the original or archive with confirmation. Pagination uses 25 rows.

Migrations 202611010001_archive_purchase_receipts.sql and 202611010002_receipt_branch_access.sql and 202611010003_receipt_unlimited_uploads.sql were applied to staging only. Apply them to production before publishing this feature. The feature is released with AI disabled in staging and production.

Categories: Supplier Invoice and Miscellaneous. Daily allowances reset at Toronto midnight; the shared monthly scan allowance resets at UTC month start. Scope-specific duplicate detection permits different branches to upload the same source independently. Quota reservations are serialized with a database advisory lock.

The shared admin/manager list supports server-side vendor/invoice-number search, category and status filters before pagination. Uploads and successful rescans are Draft; reviewed saves display Completed (persisted as SAVED for compatibility). Editing and saving a completed invoice keeps it Completed.

## Release security review

Do not enable hosted AI until the exposed Azure key is rotated by the account owner, private server-only keys are configured separately in Vercel Production and Preview, and the Azure firewall permits the hosted server. Never enable every network as a workaround without explicit approval.

Apply 202611010004_receipt_scan_budget.sql to each environment. It caps each database at 100 attempts/month, 10/user/Toronto day, with at most two pages/attempt. The two environments together allow at most 400 Azure pages/month; local uses staging’s counter. Direct Azure Studio use or other applications are outside this limit. Keep Azure F0; app counters are not a subscription-wide spending cap.

Quota failure blocks scans before downloading originals or contacting Azure. Azure fetches reject redirects. Files remain private, scoped by authenticated active role/branch; authenticated clients cannot write quotas or invoke reservation functions. No general WAF/login throttling or total storage cap has been verified: unlimited uploads can still incur storage/traffic costs. Configure platform abuse controls before public production use.

Security dependency check: Next.js and eslint-config-next updated to 16.4.3. shadcn CLI moved to devDependencies. Production npm audit reported zero findings after compatible fixes; development-only advisories remain and were not force-downgraded. Private source/bundle secret scans found no matches. Staging budget migration and rollback-only access/quota checks passed. Rotated scanner key validated with a non-billable model lookup and saved as a server-only Vercel Secret for Production and Preview; AI switch is false on both. Azure remains Free with Selected Networks (local IP only), so hosted AI is intentionally not enabled. Production receipt migrations were applied after approval; the existing production receipt, file reference and scan history were verified unchanged.
