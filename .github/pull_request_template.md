## What and why

<!-- One or two sentences. -->

## Target

- [ ] `main` — Ahaa business app (merging deploys **www.aahastore.com** production)
- [ ] `platform` — operations / superadmin console (merging deploys **operations-platform-admin**)

## Release checklist

- [ ] CI is green (tests, types, lint, module boundaries, business + platform builds)
- [ ] Tested on this pull request's Vercel preview link (business changes) or the local platform console (platform changes)
- [ ] Database migrations: none — or rehearsed (rollback-only) and applied to the **staging** database, and applied to **production before merging** to `main`
- [ ] New feature flags default **off**; any hosted flag change is listed below
- [ ] Docs updated if deployment, flags or business rules changed

## Notes for reviewers

<!-- Risks, screenshots, follow-ups. -->
