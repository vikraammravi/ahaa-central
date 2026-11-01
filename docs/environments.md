# Staging and production rollout

## Target configuration

| Environment | Git branch | Vercel project | Supabase |
| --- | --- | --- | --- |
| Production | `main` | Existing `ahaa-central` | Existing `znfedioxsrvvjtfnpszw` project; keep live records |
| Staging | `staging` | Separate `ahaa-central-staging` (pending) | `Ahaa-Staging`, project `rvldwakcwxbnqyuttzkn`; no production users or transactions |

Production custom domain: `aahastore.com`. Hostinger retains domain/DNS management; Vercel hosts the application. No VPS purchase is required.

The staging project was created in East US (North Virginia), `us-east-1`. Its schema baseline was validated in a rollback-only transaction and then applied. All 16 application tables have RLS enabled. Vercel staging and the production custom domain are not configured yet.

## Rollout order

1. Preserve uncommitted receipt/sidebar work outside the setup checkout. Do not include it in releases.
2. Create the staging Supabase project, with a password entered and retained by the account owner.
3. Export and review a complete application-schema baseline from production. The existing migration directory starts with alterations to pre-existing tables and cannot initialize a blank database alone.
4. Apply the baseline only to the empty staging project. Verify tables, constraints, functions, policies, sequences, triggers and permissions. Establish migration history against the baseline so old alterations are not reapplied.
5. Provision separate test logins and fixtures in staging. Never copy production auth users, password hashes, orders, invoice history or file objects by default.
6. Create a separate Vercel staging project from the same GitHub repository, using `staging` as its production branch. Its Production, Preview and Development scopes must contain staging credentials exclusively. Disable optional credentials until those features are being tested.
7. Restrict the existing production Vercel project to releases from `main`. Remove production credentials from its Preview/Development scopes; prevent staging/feature branches from deploying through that production project with live credentials.
8. Verify production build and test gates. Configure pull requests and required checks where the GitHub plan/repository supports enforcement. Do not represent these protections as active until verified.
9. Run staging role/access, stock, ordering, pickup, catering and invoice/PDF tests. Use the deployed staging app to confirm that writing test records cannot affect production.
10. Add `aahastore.com` and the chosen `www` redirect in Vercel. Use the exact DNS records Vercel supplies; preserve unrelated mail/DNS records. Confirm no existing website is displaced before switching records.
11. Configure production Supabase Site URL/password-recovery redirect to the final production origin; keep staging redirects separate. Verify login, profile, password recovery and PDF links on the custom domain.
12. Verify the live domain, TLS, redirects, deployment commit and database project. Record actual endpoints and backups in the handover.

## Environment variables

Each project must use its own values for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the existing supported anon-key alternative)
- `SUPABASE_SECRET_KEY` (server only; or the supported service-role alternative)

Never copy production server credentials into staging, preview deployments, screenshots, Git or chat. Keys prefixed `NEXT_PUBLIC_` are intentionally browser-visible; server secrets must never use that prefix. Password-reset SMTP and Azure scanning require their own separately verified configuration.

## Release flow

Feature branch -> pull request into `staging` -> staging deployment and verification -> pull request from `staging` into `main` -> production release.

Database migrations are versioned files. Test on staging first, then apply the same reviewed forward-compatible migration to production before deploying code that depends on it. Production data is never replaced by staging data. Application rollback does not undo a database migration; take a backup and use a reviewed corrective migration when necessary.

## Pending feature

Vendor receipt scanning is unfinished and excluded from the current production commit. Its draft table/bucket were already added to the existing database, so include them in the schema inventory even though the production UI has no receipt entry. Azure currently returns a Virtual Network error. Do not enable the feature as part of environment separation.
