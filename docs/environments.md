# Environment setup

Two Vercel projects build this repository, kept separate by branch (updated November 20, 2026):

| Project | Deployment | Branch | Supabase | Domain |
| --- | --- | --- | --- | --- |
| ahaa-central (Ahaa business) | Production | main | znfedioxsrvvjtfnpszw | https://www.aahastore.com |
| ahaa-central (Ahaa business) | Preview | staging and feature branches (never `platform`) | rvldwakcwxbnqyuttzkn | Vercel preview URLs only |
| operations-platform-admin (superadmin / operations) | Production | platform | rvldwakcwxbnqyuttzkn | https://operations-platform-admin.vercel.app |

- `staging.aahastore.com` was removed from the ahaa-central project on November 20, 2026 (user decision). Its DNS record still exists at the registrar (nameservers `*.dns-parking.com`) and now resolves to a Vercel 404; delete it there. The `staging` branch and the staging Supabase project remain.
- ahaa-central's Ignored Build Step is a custom command that skips only the `platform` branch: `if [ "$VERCEL_GIT_COMMIT_REF" = "platform" ]; then exit 0; else exit 1; fi`. Superadmin code ships only through `platform`.
- Without a hosted Ahaa staging site, check Ahaa changes locally against the staging database (or a Vercel preview URL) before promoting `main`.

The three Supabase settings are scoped independently to Production and Preview. Rebuild main with Production settings; do not directly promote a preview build because public variables are embedded at build time. Local development uses staging settings. Private credentials remain in ignored local files.

Staging contains verified copies of all 16 business tables and one private receipt file. Five matching accounts use separate passwords. Production hashes and sessions were not copied. All 16 tables have RLS and user triggers are enabled. Private snapshots, credentials and verification reports remain outside Git.

Preview branch tracking is enabled; Production tracks main. Verify changes in staging before a reviewed main release. Branch protections and automatic database migration deployment are not configured. Test versioned migrations in staging, then apply the reviewed migration to production before dependent code. Never copy staging data back over production.

The schema baseline was applied and tested. Migration-history reconciliation remains pending. Production DNS, auth redirects and both deployments are configured. Vendor invoices are deployed with hosted AI explicitly disabled. Never change that switch before confirming quota migrations, server-only keys and hosted Azure connectivity.
