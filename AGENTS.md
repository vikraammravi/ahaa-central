<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Ahaa delivery workflows

For Ahaa feature implementation and multi-module changes, use `skills/ahaa-orchestrate/SKILL.md`. For bug fixing, use `skills/ahaa-fix-bug/SKILL.md`. These workflows coordinate development, testing and independent review agents; follow their scoped handoffs and completion evidence. For explanation-only requests, answer directly without starting delivery agents.

All delivery roles read `docs/agent-workflows/repository-context.md` and `docs/agent-workflows/delivery-contract.md`. Run `node scripts/index-agent-context.mjs` for current code discovery, then inspect the affected files. Keep the shared context current after verified architecture or deployment changes; historical checkpoints do not establish the current hosted state.
