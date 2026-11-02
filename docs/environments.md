# Environment setup

One Vercel project: ahaa-central.

| Deployment | Branch | Supabase | Domain |
| --- | --- | --- | --- |
| Production | main | znfedioxsrvvjtfnpszw | https://www.aahastore.com |
| Preview / staging | staging and feature branches | rvldwakcwxbnqyuttzkn | https://staging.aahastore.com |

The three Supabase settings are scoped independently to Production and Preview. Rebuild main with Production settings; do not directly promote a preview build because public variables are embedded at build time. Local development uses staging settings. Private credentials remain in ignored local files.

Staging contains verified copies of all 16 business tables and one private receipt file. Five matching accounts use separate passwords. Production hashes and sessions were not copied. All 16 tables have RLS and user triggers are enabled. Private snapshots, credentials and verification reports remain outside Git.

Preview branch tracking is enabled; Production tracks main. Verify changes in staging before a reviewed main release. Branch protections and automatic database migration deployment are not configured. Test versioned migrations in staging, then apply the reviewed migration to production before dependent code. Never copy staging data back over production.

The schema baseline was applied and tested. Migration-history reconciliation remains pending. Production DNS, auth redirects and both deployments are configured. Vendor invoices are deployed with hosted AI explicitly disabled. Never change that switch before confirming quota migrations, server-only keys and hosted Azure connectivity.
