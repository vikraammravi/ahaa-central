# SaaS implementation steps

Branch: codex/business-isolation. Production changes are excluded from this work until an explicit promotion.

1. **Existing module boundaries — complete.** Shared features, server modules, UI primitives and dependency checks are committed on the parent branch.
2. **Business registry foundation — complete in staging only.** Four control-plane tables, Ahaa memberships and the explicitly approved staging platform role are installed and verified.
3. **Workspace authorization — core implemented, routing integration pending.** Shared selected-business parsing and membership profile resolution; browser/server propagation; membership-aware privileged invoice access. The opt-in NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED flag defaults off. No fallback to global profile privileges when workspace authorization fails. See business-isolation-progress.md.
4. **Operational database isolation — first rollback rehearsal passed, not installed.** Business ownership, compatible composite references, restricted function execution and scoped receipt functions. Existing operational record checksums and the original fulfillment/Ready-stock regressions passed. Drafts stay outside migrations until the paired application code and full acceptance matrix pass. Environment-wide AI budget limits remain shared across businesses.
5. **Workspace selection and membership management — pending.** Authorized workspace chooser, role-aware navigation, user management within a membership, last-admin protection, safe removal of one membership without deleting another business's login, and cache/editor invalidation when changing workspaces.
6. **Cross-business acceptance — pending.** Two-business tests for direct queries, every callable elevated function, service-role routes, PDFs, files, orders, pickup, invoices, inventory and revoked access. Compare original operational data before/after migration; all rehearsal fixtures roll back.
7. **Minimal superadmin — pending isolation acceptance.** Business provisioning and first-owner invitation, supported configuration, suspension and usage. Keep platform permission separate from customer roles and customer financial-data access. Audit configuration changes. No arbitrary workflow builder or automatic platform-role grants.
8. **Staging release and review — pending.** Verify production-default mode, then deploy staging with its own configuration. Prove the new workspace mode on the staged database and exercise desktop/tablet/mobile screens. No second business activated before API/database isolation passes.
9. **Production promotion — separate explicit approval.** Back up, reconcile migration history, apply verified migrations and promote the reviewed release. No production feature flag or domain changes during the development steps above.

Independent frontend/API deployments are a later extraction when operational needs justify them; they are not required to establish tenant security.
