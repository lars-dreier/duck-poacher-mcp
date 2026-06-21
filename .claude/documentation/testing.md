---
title: "Testing Guide"
description: "How the test suite is structured and run: the node:test runner via tsx, live integration tests against the real external dependency, the offline unit specs, shared fixtures, and conventions."
category: "guide"
tags: ["testing", "node-test", "tsx", "integration", "live-api", "conventions"]
last_updated: "2026-06-21T00:00:00Z"
related_docs: ["code-style.md"]
---

# Testing Guide

The examples below are illustrative — generic spec and helper names stand in for
whatever this project actually contains. The runner setup, the live-vs-offline
split, and the conventions are the point.

## Table of Contents
1. [Runner and Setup](#runner-and-setup)
2. [Running Tests](#running-tests)
3. [Live Integration Tests](#live-integration-tests)
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
import { describe, it } from 'node:test';
```

## Running Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Run all `test/**/*.test.ts` once |
| `npm run test:coverage` | Run with `--experimental-test-coverage` |
| `npm run test:watch` | Re-run on change |

The underlying invocation is `tsx --test "test/**/*.test.ts"`.

## Live Integration Tests

When the code under test integrates with an **external service or API**, the
tests that matter **hit the real dependency** rather than mocking it. There is no
local stub server, no recorded fixture for the network layer, and no test double
for it — those would only prove the code calls itself, not that it still works
against a live, drifting target. The client/facade specs are the live-network
validation; pure logic — parsers, value objects, and other deterministic units —
is tested offline.

Consequences to keep in mind:

- **Network is required for the integration specs.** The specs that exercise a
  client or facade hit the live service and fail without connectivity. The
  offline specs — parsers, value objects, and other pure units — run without the
  network and validate pure logic.
- **The external target can break the live specs.** A third-party service can
  change its token/auth format, the URLs it serves, its response shapes, the
  headers it accepts, and its transport (responses may be chunked and
  gzip/deflate/br-compressed). A failure here usually means the target changed,
  not that the test is flaky — investigate the real response before "fixing" the
  test.
- **Assert on shape, not content.** Specs assert structural facts — that a token
  matches an expected pattern, that a URL points at the expected host/path, that
  a call returns a non-empty array, and that every result's URLs are absolute
  http(s) URLs — never on specific results, which change constantly.
- **Generous timeouts.** Each live `it` carries an explicit `NETWORK_TIMEOUT_MS`
  timeout (e.g. 30,000 ms). Specs that must first acquire a token or session make
  two sequential requests within that budget. The offline specs need no timeout.

## Test Layout

`test/` mirrors `src/`. Each source file has a sibling spec under the matching folder:

```
test/
  TestHelper.ts                 shared fixtures (not a spec)
  Service.test.ts               live: public facade
  api/
    ApiClient.test.ts           live: token/session + request
    ResponseParser.test.ts      offline: raw string → result mapping
    SearchResult.test.ts        offline: value object
```

Specs end in `.test.ts`; support files (shared fixtures) do not, so the glob
skips them. A facade spec exercises each entry point via one `describe('Service')`
suite with nested `describe(...)` blocks per method.

## Shared Fixtures

`test/TestHelper.ts` holds the fixtures shared across the live specs — prefer it
over hand-rolling values in each test:

- A stable, result-rich input (e.g. `TEST_QUERY`) so calls return reliably
  non-empty results across runs.
- `NETWORK_TIMEOUT_MS` — the per-request budget (e.g. `30_000` ms) passed as the
  `it` timeout option.
- `assertHttpUrl(value, label)` — asserts a value is a non-empty absolute http(s)
  URL (regex: `/^https?:\/\//`), used to validate every returned URL.

These are plain fixtures and assertions, not resources — there is nothing to tear
down, so no `afterEach` cleanup is needed and none of the specs register one. The
offline specs build their own fixtures inline rather than calling the network
(e.g. a `JSON.stringify`'d payload, or a string embedding the marker a parser
scans for).

## Conventions

- **Structure:** `describe` per class with a nested `describe` per method, and an
  `it` per behavior (e.g. `describe('Service')` → `describe('search')` → `it(...)`).
- **Given/When/Then:** each `it` body carries `// Given`, `// When`, `// Then`
  comments narrating the scenario. Follow this — it is consistent across the suite.
- **Network timeout:** pass `{ timeout: NETWORK_TIMEOUT_MS }` as the `it` options
  argument on any spec that makes a request; omit it on the offline specs.
- **Shape assertions:** use `assert.match` for tokens and URLs, `assertHttpUrl`
  for returned result URLs, and `assert.ok`/`assert.equal` for array shape and the
  parsers' field mappings.

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
