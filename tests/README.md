# Tests

Run `npm test` for domain/API unit tests plus React component and UI integration tests.

- `npm run test:unit`: existing Node tests for calculations, validation, permissions and API handlers.
- `npm run test:ui`: Vitest + React Testing Library, with real components and mocked Supabase responses.
- `npm run test:watch`: watch component tests while developing.
- `npm run test:coverage`: generate `coverage/index.html` and `coverage/coverage-summary.json`.

Tests sit next to the source they cover: `UsersTable.tsx` / `UsersTable.test.tsx`, `page.tsx` / `page.test.tsx`, and domain/API `.test.mjs` files. Shared business fixtures are in `tests/mocks/fixtures.ts`; query/router mocks are in `tests/mocks/supabase.ts`. Global setup is in `tests/setup.tsx`. The setup replaces the Supabase browser client and rejects unexpected HTTP requests, so these tests require no credentials and cannot mutate production records. Tests use labels and accessible roles, real dialogs, validation and user interactions rather than snapshots of implementation details.

Coverage includes every application component/page and hook, including untested files. It excludes shadcn UI library implementations. A green test run does not mean 100% coverage: consult the report before changing an uncovered flow. Async route wrappers, browser layout/responsiveness and actual Supabase/SMTP behavior require additional browser or database verification; jsdom does not measure CSS layout. Rollback-only database integration scripts live in `supabase/tests/` and are not run automatically against production.

For each new feature, add component success/error/permission tests, a page-level interaction test, and domain tests for new business rules. Keep test-only mocks out of production code. GitHub Actions runs the tests, type checks and lint checks and saves the coverage report.

Initial baseline: 37 domain/API tests and 76 component/integration tests across 50 colocated React test files. UI coverage is 83.78% of lines and 65.36% of branches. Coverage checks require at least 80% lines, 70% statements, 60% branches and 65% functions. This intentionally reports gaps rather than claiming every branch or browser interaction has been tested.
