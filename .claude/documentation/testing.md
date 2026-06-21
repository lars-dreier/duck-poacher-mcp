---
title: "Testing Guide"
description: "How the test suite is structured and run: the node:test runner via tsx, an in-memory transport harness that wires the unit under test to a client in-process, the live calls that still reach the real external dependency, shared fixtures, and conventions."
category: "guide"
tags: ["testing", "node-test", "tsx", "integration", "in-memory-transport", "conventions"]
last_updated: "2026-06-21T15:16:15Z"
related_docs: ["code-style.md"]
---

# Testing Guide

The examples below are illustrative — generic spec and helper names stand in for
whatever this project actually contains. The runner setup, the in-memory harness,
the live-vs-offline split, and the conventions are the point.

## Table of Contents
1. [Runner and Setup](#runner-and-setup)
2. [Running Tests](#running-tests)
3. [In-Memory Harness and Live Calls](#in-memory-harness-and-live-calls)
4. [Test Layout](#test-layout)
5. [Shared Fixtures](#shared-fixtures)
6. [Conventions](#conventions)
7. [Type-Checking the Test Tree](#type-checking-the-test-tree)

---

## Runner and Setup

Tests use the **built-in `node:test` runner** with `node:assert/strict`,
executed through **tsx** so TypeScript runs without a separate compile step.
There is no Jest, Vitest, Mocha, or assertion library.

```ts
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
```

## Running Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Run all `test/**/*.test.ts` once |
| `npm run test:coverage` | Run with `--experimental-test-coverage` |
| `npm run test:watch` | Re-run on change |

The underlying invocation is `tsx --test "test/**/*.test.ts"`.

## In-Memory Harness and Live Calls

The unit under test is wired to a client over a **linked in-memory transport
pair**, so a spec drives it through its full public path — registration, request
handling, response serialization — the way a real client would, with no socket in
between. This in-process harness is **not** a network mock: it is the real unit
speaking to a real client. The deterministic checks (e.g. that the expected
operations are registered, that an error result is shaped correctly) run offline
through this harness.

When an operation delegates to an **external service or API**, the calls in those
specs still **reach the live dependency**. There is no recorded fixture, local
stub, or test double for the network layer — those would only prove the code calls
itself, not that it still works against a live, drifting target.

Consequences to keep in mind:

- **Network is required for the specs that reach the live dependency.** Those
  specs fail without connectivity. The offline checks that stay inside the harness
  (registration, error shaping, and other pure logic) run without the network.
- **The external target can break the live specs.** A third-party service can
  change its token/auth format, the URLs it serves, its response shapes, the
  headers it accepts, and its transport (responses may be chunked and
  gzip/deflate/br-compressed). A failure here usually means the target changed,
  not that the test is flaky — investigate the real response before "fixing" the
  test.
- **Assert on shape, not content.** Specs assert structural facts — that a URL
  points at an absolute http(s) endpoint, that a call returns a non-empty array,
  that each result carries the expected fields — never on specific results, which
  change constantly.
- **Generous timeouts.** Each live `it` carries an explicit `NETWORK_TIMEOUT_MS`
  timeout (e.g. 30,000 ms). The offline checks inside the harness need no timeout.

## Test Layout

`test/` holds the specs and the shared harness/fixtures. A spec may cover an
entire surface in **one file** — offline checks (e.g. registration, error shaping)
and live calls (one `describe` per operation) side by side — rather than a deep
mirror of the source tree:

```
test/
  TestHelper.ts                 shared harness + fixtures (not a spec)
  <Unit>.test.ts                offline registration checks + live per-operation calls
```

Specs end in `.test.ts`; support files (the shared harness/fixtures) do not, so
the glob skips them. Each spec is one `describe('<Unit>')` suite with nested
`describe(...)` blocks per behavior or operation.

## Shared Fixtures

`test/TestHelper.ts` holds the **harness builder** and the fixtures shared across
specs — prefer it over hand-rolling values in each test:

- A harness builder (e.g. `connectTestClient()`) that spins up the unit under
  test, links it to a client over an in-memory transport pair, connects both, and
  returns the client plus a `close()` to tear them down.
- A result parser (e.g. `parseToolResults(result)`) that asserts a result is a
  successful single text block and returns its parsed JSON payload.
- A stable, result-rich input (e.g. `TEST_QUERY`) so live calls return reliably
  non-empty results across runs.
- `NETWORK_TIMEOUT_MS` — the per-request budget (e.g. `30_000` ms) passed as the
  `it` timeout option.
- `assertHttpUrl(value, label)` — asserts a value is a non-empty absolute http(s)
  URL (regex: `/^https?:\/\//`), used to validate every returned URL.

The harness owns a **live client connection**, so specs that use it set it up in a
`before` hook and tear it down in an `after` hook that calls `close()` — this is
the one resource the suite owns. The plain fixtures and assertions (`TEST_QUERY`,
`NETWORK_TIMEOUT_MS`, `assertHttpUrl`) are not resources and need no cleanup.

## Conventions

- **Structure:** `describe` per unit with a nested `describe` per behavior or
  operation, and an `it` per case (e.g. `describe('<Unit>')` →
  `describe('<operation>')` → `it(...)`).
- **Lifecycle:** build the harness in `before`, tear it down in `after` via
  `close()`; the harness connection is the one resource the suite owns.
- **Given/When/Then:** each `it` body carries `// Given`, `// When`, `// Then`
  comments narrating the scenario. Follow this — it is consistent across the suite.
- **Network timeout:** pass `{ timeout: NETWORK_TIMEOUT_MS }` as the `it` options
  argument on any spec that reaches the live dependency; omit it on the offline
  checks.
- **Shape assertions:** use `assert.match` for URLs and patterns, `assertHttpUrl`
  for returned URLs, and `assert.ok`/`assert.equal` for array shape and
  registration/field checks.

## Type-Checking the Test Tree

The build `tsconfig.json` has `rootDir: ./src` and must not see test files, so the
test tree is type-checked through a separate **`tsconfig.test.json`** that extends
it, sets `rootDir: .` / `noEmit: true`, and widens `include` to `src` + `test`.

ESLint wires the test tree to that config via `eslint.config.mjs` and **disables
`@typescript-eslint/no-floating-promises` for `test/**`** — `node:test`'s
`describe`/`it` return promises that must not be awaited at the call site, so the
rule would be all false positives there. The rule stays **on** in `src/`, where an
unawaited promise is a real defect. Keep test code inside this carve-out; don't
disable the rule in `src/`.
