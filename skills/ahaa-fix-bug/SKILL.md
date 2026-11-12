---
name: ahaa-fix-bug
description: Diagnose and fix Ahaa bugs from reproduction through root cause, regression tests and independent review. Use for broken behavior, UI defects, access failures or regressions in ahaa-central.
---

# Ahaa bug fixing

Read repo `AGENTS.md`, `docs/agent-workflows/repository-context.md` and `docs/agent-workflows/delivery-contract.md`. Locate the current Ahaa checkout, index it, identify the owning module and inspect existing callers/tests before proposing changes. Keep feature expansion out of the bug fix unless necessary for correctness.

1. Record expected versus actual behavior, role, environment, input and reproduction steps. Discover what the code/session already reveals; ask only for missing reproduction details that matter. Check exact deployed commit, flags and schema for environment-only failures. Do not expose secrets or private records in reports.
2. Trace from UI through data/API/RPC/policy/provider as applicable. Find the root cause; a frontend workaround for server authorization or migration mismatch is not a fix. Prove the failure with a reproduction or failing regression test when practical.
3. Use a developer agent with `$ahaa-develop` for a scoped repair, a separate `$ahaa-test` agent for regression coverage and an independent `$ahaa-review` agent for final assessment. Supply each role's exact `skills/<skill-name>/SKILL.md` path (or installed path), the original report and root-cause evidence; avoid parallel writers on the same files. For a small fix, keep handoffs concise. If agents are unavailable, perform roles sequentially and disclose that review was not independent.
4. Make the smallest complete correction that fits the module boundaries. Tests stay beside code and fixtures in `tests/mocks`. Verify the original scenario and the adjacent behavior likely to regress. A simple CSS change needs real viewport inspection rather than artificial tests of class strings.
5. Report cause, fix, meaningful checks, remaining limitations and exact release state. If authorized to release, verify staging and then production as appropriate. Preserve unrelated work; never reset data, alter permissions, send emails or incur provider charges just to reproduce a bug without corresponding authorization.

Do not repeatedly request a screenshot or question if an existing session, code path or logs can establish the issue. Do not declare fixed solely from a passing mock when the reported failure depends on live permissions, network settings or database state.
