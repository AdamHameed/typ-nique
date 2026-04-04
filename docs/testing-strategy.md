# Testing Strategy

## Plan

This project benefits from a layered test pyramid:

1. Unit tests for pure checker and scoring logic.
2. Route-level integration tests for API contracts, validation, rate limiting, and error mapping.
3. Component tests for key interactive and summary UI surfaces.
4. Browser end-to-end tests for the full game loop, using network stubs so CI stays deterministic.
5. Regression fixtures for accepted-answer edge cases that should never silently flip behavior.

## Coverage targets

- Typst source normalization:
  `packages/checker/test/source-normalization.test.ts`
- SVG normalization:
  `packages/checker/test/svg-normalization.test.ts`
- Render equivalence logic:
  `packages/checker/test/render-equivalence.test.ts`
- Scoring logic:
  `apps/api/test/services/scoring.test.ts`
- API flows for sessions and submissions:
  `apps/api/test/routes/*.test.ts`
- Frontend components:
  `apps/web/test/components/*.test.tsx`
- End-to-end game flow:
  `apps/web/e2e/game-flow.spec.ts`
- Tricky accepted-answer regressions:
  `packages/checker/test/fixtures/accepted-answer-regressions.json`
  `packages/checker/test/scoring-and-regressions.test.ts`

## Folder structure

```text
apps/
  api/
    src/services/scoring.ts
    test/
      routes/
        game-session-routes.test.ts
        submission-routes.test.ts
      services/
        scoring.test.ts
  web/
    e2e/
      game-flow.spec.ts
    test/
      components/
        results-overview.test.tsx
        typst-editor.test.tsx
      setup.ts
packages/
  checker/
    test/
      fixtures/
        accepted-answer-regressions.json
      helpers.ts
      render-equivalence.test.ts
      scoring-and-regressions.test.ts
      source-normalization.test.ts
      svg-normalization.test.ts
playwright.config.ts
vitest.workspace.ts
```

## CI-friendly commands

- Install browser once in CI:
  `pnpm test:e2e:install`
- Run unit and integration suites:
  `pnpm test:unit`
- Run all Vitest suites with coverage:
  `pnpm test:coverage`
- Run browser flow checks:
  `pnpm test:e2e`
- Run the full CI test bundle:
  `pnpm test:ci`

## Fixture guidance

- Keep accepted-answer regressions as JSON fixtures so product and checker changes can add cases without rewriting test logic.
- Prefer SVG fixtures that isolate one tolerance at a time: ids, numeric precision, attribute ordering, and viewBox mismatches.
- For future API integration tests, add reusable factories for session state payloads so route tests stay focused on behavior.
