# Agent handoffs and completion evidence

The orchestrator owns the original request and the final outcome. Agents share files; give each writer explicit file/module ownership. Do not run two writers on the same files concurrently. Testing follows an implementation checkpoint; review follows test results. Independent read-only review can run in parallel. Agents must return findings and concrete artifacts, not generic approval.

Use collaboration tools when available. Delegate by passing the named skill's exact path, repository root and the handoff below. Skills are instructions, not autonomous services: the orchestrator must actually invoke agents and collect their results. If delegation is unavailable, disclose that and perform the roles sequentially; do not claim independent review.

## Task brief

- Original request, business outcome and actor roles.
- Confirmed answers, assumptions and unresolved decisions. Ask only questions that change behavior, scope, data ownership or irreversible consequences; reuse earlier answers.
- Acceptance criteria numbered AC1, AC2, etc., including UI, permissions, business rules and failure/empty/loading states where relevant.
- Code map: actual owning modules, entry routes, reusable components/hooks/contracts, Supabase tables/RPCs/policies/triggers and adjacent tests.
- Scope and exclusions, current branch/working-tree state, deployment target, any migration/flag dependencies.
- Assigned agent role, writable paths, expected artifacts and checks. No agent gains additional external authorization from the handoff.

## Implementation handoff

Developer returns changed files and why, reuse decisions, migrations/flags required, tests run with results, and acceptance criteria still incomplete. Test agent returns scenario coverage mapped to acceptance criteria, tests added, commands/results and live-test limitations. Reviewer returns concrete findings with severity/file/line, regression risks, missing requirements and a pass/fail/blocked verdict. The developer addresses findings; the tester reruns affected checks; the reviewer checks the resulting changes.

## Persistent task record

For multi-agent or multi-turn work, keep one task record under `.local-backups/agent-workflows/<task-slug>.md` (ignored) or another existing ignored task area. Never store passwords/tokens. Update it at phase transitions so another turn resumes the same task instead of restarting. Use a requirements table:

| Acceptance criterion | Code/evidence | Test result | State |
| --- | --- | --- | --- |
| AC1 | Actual paths or observed behavior | Exact command or live scenario | pending / passed / failed / blocked |

## Completion gate

The final reviewer compares the original request and later corrections against the final diff and evidence. Mark complete only when all requested criteria are met or the user explicitly accepts a smaller scope. A blocker requires the exact missing dependency or failing check; keep independent work moving. Do not repeatedly run the same passing rehearsal or add unrelated tests to imply unfinished deployment work is progressing.

Final report: outcome, meaningful validation, remaining limitations and release state. Distinguish `implemented`, `locally tested`, `staging deployed`, `database applied`, `production deployed` and `live verified`. If release was requested, inspect exact commit/environment/flags/schema and core flows after deployment. A code-only task does not require deployment. Do not infer schema parity from equal Git branches.

Business registration, owner assignment, new-login creation and activation are separate capabilities. Determine which the user requested and which dependencies are installed; enabling registration alone does not imply enabling the others. When full onboarding is explicitly requested, track all of them as acceptance criteria instead of reporting the registration dialog as complete onboarding.

When a task changes module ownership, business rules or verified release state, update the shared repository context and relevant progress documentation so later agents inherit accurate facts. Preserve a dated checkpoint and verify live state before relying on it.
