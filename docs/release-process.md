# Release process

Two long-lived branches, two Vercel projects:

| Branch | Purpose | Deploys to |
| --- | --- | --- |
| `main` | Ahaa business app | ahaa-central → https://www.aahastore.com (production) |
| `platform` | Operations / superadmin console | operations-platform-admin → https://operations-platform-admin.vercel.app |

There is no `staging` branch or `staging.aahastore.com` site (removed November 20, 2026). Every other branch gets a Vercel preview link on the ahaa-central project, connected to the staging database; ahaa-central skips builds of `platform`.

## Everyday flow

1. Branch from `main` (business) or `platform` (operations) and open a pull request into it. The pull request template carries the release checklist.
2. GitHub Actions (`.github/workflows/tests.yml`) runs on every push and pull request: module boundaries, unit + UI tests with coverage, type-check, lint, and production builds of both the business and platform surfaces.
3. Test the preview link (business) or the local two-surface setup (platform).
4. Database migrations: rehearse rollback-only on staging, apply to staging, then apply to production **before** merging to `main`.
5. Merge. Vercel deploys automatically.

## Keeping platform in sync

`.github/workflows/sync-main-to-platform.yml` runs whenever `main` changes. If `platform` does not already contain `main`, it opens (or comments on) a pull request **main → platform**, so Ahaa fixes and shared code reach the operations console and the branches do not drift. Review and merge it like any other pull request; resolve conflicts there.

Once platform onboarding is released to production (behind flags that default off), merge `platform` into `main` and point operations-platform-admin back at `main` with `APP_SURFACE=platform`, so one branch feeds both deployments.

## One-time GitHub settings

- Settings → Actions → General → Workflow permissions: allow GitHub Actions to **create and approve pull requests** (needed by the sync workflow).
- Pull requests opened by the sync workflow do not trigger other workflows (GitHub rule for the built-in token); CI still runs on the resulting push to `platform`. Re-run checks from the pull request if you want them before merging.
- Protect `main` and `platform` (Settings → Branches or Rules): require a pull request and the `Tests` checks before merging. On a private repository this needs a paid GitHub plan; without it, follow the flow above by habit.
