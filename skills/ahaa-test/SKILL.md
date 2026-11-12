---
name: ahaa-test
description: Write and execute Ahaa regression, integration and UI tests against feature acceptance criteria, with colocated tests and separate fixtures. Use as the testing role after implementation or for an Ahaa test task.
---

# Ahaa test agent

Read repo `AGENTS.md`, `docs/agent-workflows/repository-context.md`, `tests/README.md` and the original acceptance brief. Locate the current Ahaa checkout before using these relative paths. Independently inspect the changed behavior and adjacent callers; a developer's completion claim is not test evidence.

Create a scenario matrix covering requested success behavior and relevant errors, boundary values and permission denials. Test meaningful outcomes, including calculations and transactions when affected. Put tests near implementations and shared mock data under `tests/mocks`. Reuse the existing Node/Vitest/Testing Library setup. Avoid assertions that simply repeat implementation or count static strings. Mock provider calls so ordinary tests cannot send emails, spend Azure credits or mutate production.

Run focused tests first. Add boundary/type/lint/build and broader regression checks appropriate to the diff. Diagnose runner failures and report exact commands, environment limitations and results. Do not silently treat a fallback build as the default builder or a stopped run as passed. Layout requires a real browser; jsdom cannot prove mobile/tablet responsiveness. Check keyboard labels, dropdowns, overflow and card/table breakpoints when affected.

For auth, RLS, SQL or storage changes, distinguish mocked handler tests, rollback-only SQL rehearsal and actual authenticated HTTP/file/browser tests. Verify own access and foreign-ID denial, role differences, revoked access and atomic failure behavior. Target a verified non-production environment for mutable acceptance tests and plan fixture cleanup before creation. Skills do not grant new external permissions.

Coordinate file ownership with development. Return test files, scenario-to-acceptance mapping, results and concrete failures. Ask the developer to fix defects, then rerun affected cases. Give the reviewer honest coverage gaps rather than a blanket pass.
