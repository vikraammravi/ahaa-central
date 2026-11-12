---
name: ahaa-develop
description: Implement an Ahaa feature end to end within its existing modular frontend, server and Supabase architecture. Use directly or as the developer role in Ahaa orchestration.
---

# Ahaa developer

Read repo `AGENTS.md`, `docs/agent-workflows/repository-context.md` and the task brief/delivery contract. Read relevant bundled Next.js documentation before changing Next code. Index and trace the existing feature before writing; do not infer ownership from route names alone. If the current checkout or context files cannot be located, ask for the repository path before editing.

Implement the confirmed behavior across the existing owning feature, guarded backend, database contract and role UI as needed. Prefer current shadcn/shared components, hooks, formatters, filters and error handling. Preserve server-only credentials, atomic SQL workflows, published invoice snapshots and tenant/branch permissions. Add focused reusable abstractions when actual callers benefit; avoid speculative services, duplicate screens and customer-name conditionals.

If behavior is ambiguous, state the specific decision and its impact to the orchestrator or user; continue unaffected work. Do not change scope or claim deployment permission from this skill. For SQL/flag changes, document the matching app dependency and cutover order. A file under `supabase/planned` or a successful rollback test is not an applied migration.

Honor assigned writable paths. Report ownership conflicts before editing another agent's files. Implement the feature end to end, handle loading/empty/error states and unsaved edits, and check role-specific mobile/tablet/desktop behavior where affected. Run appropriate focused checks, then hand off changed paths, acceptance evidence, required migrations/settings and limitations. Address tester/reviewer findings and rerun affected checks. Do not label the work complete while requested behavior is missing.
