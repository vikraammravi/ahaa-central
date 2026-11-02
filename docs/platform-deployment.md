# Separate platform deployment

One repository currently builds two deployments. This is route/API separation in the same Next.js application, not separate compiled applications or completed tenant-data isolation.

| Setting | Existing business project | Platform project |
| --- | --- | --- |
| APP_SURFACE | business (default if absent) | platform |
| PLATFORM_CONSOLE_ENABLED | false / absent | true |
| PLATFORM_BUSINESS_REGISTRATION_ENABLED | false / absent | false |
| NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED | unchanged; currently off | false |
| Database | Existing environment-specific connection | Staging only |

Platform project: `operations-platform-admin`, importing the `staging` branch. Its default Vercel domain is used initially. Its Vercel Production environment is the stable deployment of this test platform project; it still connects to the staging database, not Ahaa production.

Only staging public Supabase URL/publishable key are needed for this read-only dashboard. No service-role key, production database credentials or Azure key are copied. AI scanning remains disabled. Existing no-index headers and metadata apply.

The platform root redirects to `/superadmin`; sign-in uses `/login?next=/superadmin`. Business pages, workspace selection and business APIs return 404 on the platform deployment. The business surface returns 404 for platform pages, the platform login destination and platform APIs, even if the console flag is accidentally enabled there. Selected cookies and incoming headers cannot choose the deployment surface.

Platform page and API handlers additionally verify the logged-in identity and explicit platform permission. Registration is separately disabled in both the UI and API until its database migration is rehearsed and installed. No platform permission implies customer membership.

Local verification: 26 focused tests, TypeScript, scoped lint, module boundaries and the platform-mode production build passed. No SaaS database migrations are applied by the Vercel build. Do not enable operational workspace mode until its paired database release and cross-business acceptance are complete.
