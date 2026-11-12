---
name: ahaa-orchestrate
description: Coordinate Ahaa feature delivery across code discovery, requirements, developer, test and independent review agents. Use for new features or multi-module changes in ahaa-central.
---

# Ahaa feature orchestration

Operate from the Ahaa repository root. Read `AGENTS.md`, `docs/agent-workflows/repository-context.md` and `docs/agent-workflows/delivery-contract.md`. If this is a globally installed copy, locate the current Ahaa checkout rather than assuming a fixed Windows path. If the repo/context is unavailable, ask for its location before editing.

1. Index the current repo with `node scripts/index-agent-context.mjs`, then read relevant implementations, callers and tests. Inspect Git status and preserve unrelated work. Treat historical deployment notes as unverified until checked.
2. Convert the user's request and corrections into a task brief and acceptance criteria using the delivery contract. Explain the proposed behavior in plain language. Ask concise questions only for consequential ambiguity not answered by the code or conversation; continue independent discovery while waiting. Do not repeatedly ask for authorization already given.
3. Create the ignored task record. Assign the developer agent `$ahaa-develop` with exact skill path, brief and owning modules. Let it complete the implementation end to end, including UI/data/API/SQL as required. Questions go back through the orchestrator so answers stay consistent.
4. After a developer checkpoint, invoke a separate `$ahaa-test` agent with the original brief and changed paths. It writes meaningful tests near source and keeps fixtures separate. Pass defects back to development; avoid competing edits.
5. Invoke an independent `$ahaa-review` agent with the original request, acceptance criteria, final diff and test evidence. It must inspect implementation and requirement gaps rather than accept the developer's summary. Resolve findings, rerun affected checks and collect final review.
6. Perform authorized staging/release work only after the corresponding checks. Finish with the acceptance table and truthful implementation/deployment state. If work remains, report it as incomplete with a concrete blocker, not as a successful wrap-up.

Use role skills in `skills/` when available; otherwise use their installed skill paths. This workflow explicitly calls for subagent delegation when collaboration tools are available. Do not recursively create another orchestrator. Reuse agents for follow-up fixes. Keep progress updates focused on results, blockers and the next resolving action.
