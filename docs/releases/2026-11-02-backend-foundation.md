# Backend foundation release — November 2, 2026

Release includes the staged feature-module refactor, disabled workspace integration, separately gated platform dashboard and business/platform backend namespaces. Previous production commit: `47d2d94`. Backend checkpoint: `a0e44b1`.

## Release checks

- 37 Node unit tests and 296 Vitest tests across 89 files passed (333 tests total).
- Coverage passed configured thresholds: statements 80.48%, branches 74.33%, functions 78.77%, lines 88.31%.
- Full source/test/script ESLint, TypeScript, dependency boundaries and release whitespace checks passed.
- Production-mode webpack build passed with business surface and all workspace/platform feature flags disabled.
- Staging admin login, receipt loading and authenticated invoice PDF generation passed. Unauthenticated API access and cross-surface routes were rejected.
- Real staging manager login, assigned-branch dashboard, mobile ordering cards and tablet inventory loaded. Both tested viewports had no document-level horizontal overflow. Leaving inventory edit mode displayed the shared warning; changes were discarded without saving.
- Employee login opened assigned-branch inventory, showed employee navigation, and redirected an attempted manager order URL back to employee inventory.
- Rollback-only staging SQL passed atomic fulfillment, stale edits, zero fulfillment, Ready stock deduction, dashboard bounds/counts and role restrictions. All SQL fixtures/stock changes rolled back.
- Read-only database verification confirmed staging retains foundation-only SaaS metadata; operational isolation remains unapplied. Production has no SaaS foundation tables.

## Deployment boundaries

Production uses the default business surface. Platform pages/APIs remain unavailable, workspace mode remains disabled, and existing single-business authorization stays in use. The separate platform Vercel project stays connected to staging with registration and AI scanning disabled.

No database migrations, Auth account changes, permissions grants, credential rotations or feature activation are part of promotion. SQL migration/draft files in Git are not applied by the existing build or test workflows. Live Azure scans are not used in verification.

## Rollback

If production verification fails, restore the previous Vercel production deployment for `47d2d94` and reconcile Git before another release. There is no database migration to reverse for this promotion. Production verification follows deployment; the checks above are pre-release evidence, not a claim that every possible application path is covered.
