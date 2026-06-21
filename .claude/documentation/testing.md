---
title: "Testing Guide"
description: "How the test suite is structured and run: the node:test runner via tsx, an in-memory transport harness that wires the unit under test to a client in-process, the live calls that still reach the real external dependency, shared fixtures, and conventions."
category: "guide"
tags: ["testing", "node-test", "tsx", "integration", "in-memory-transport", "conventions"]
last_updated: "2026-06-21T22:40:19Z"
related_docs: ["code-style.md"]
---

# Testing Guide

How the suite is structured and run. Helper and fixture names below are the real
ones exported from `test/TestHelper.ts`; the runner setup, the in-memory harness,
the live-vs-offline split, and the conventions are the point.

## Table of Contents
1. [Runner and Setup](#runner-and-setup)
2. [Running Tests](#running-tests)
3. [In-Memory Harness and Live Calls](#in-memory-harness-and-live-calls)
4. [Test Layout](#test-layout)
5. [Shared Fixtures and Helpers](#shared-fixtures-and-helpers)
6. [Conventions](#conventions)
7. [Type-Checking the Test Tree](#type-checking-the-test-tree)

---

## Runner and Setup

Tests use the **built-in `node:test` runner** with `node:assert/strict`, executed
through **tsx** so TypeScript runs without a separate compile step. There is no
Jest, Vitest, Mocha, or external assertion library.

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

The harness wires a real `DuckPoacherServer` to a real MCP `Client` over a **linked
in-memory transport pair** (`InMemoryTransport.createLinkedPair()`), so a spec drives
the server through its full public path — tool registration, request handling,
response serialization — the way a real client would, with no socket in between.
This in-process harness is **not** a network mock: it is the real server speaking to
a real client. The deterministic checks (e.g. that the expected tools are registered,
that an error result is shaped correctly) run offline through this harness.

When a tool delegates to the **external service** (the live DuckDuckGo endpoints),
the calls in those specs still **reach the live dependency**. There is no recorded
fixture, local stub, or test double for the network layer — those would only prove
the code calls itself, not that it still works against a live, drifting target.

Consequences to keep in mind:

- **Network is required for the specs that reach the live dependency.** Those specs
  fail without connectivity. The offline checks that stay inside the harness
  (registration, error shaping, and other pure logic) run without the network.
- **The external target can break the live specs.** The upstream service can change
  its token/auth format, the URLs it serves, its response shapes, the headers it
  accepts, and its transport (responses may be chunked and gzip/deflate/br-compressed).
  A failure here usually means the target changed, not that the test is flaky —
  investigate the real response before "fixing" the test.
- **Assert on shape, not content.** Specs assert structural facts — that a URL points
  at an absolute http(s) endpoint, that a call returns a non-empty array, that each
  result carries the expected fields — never on specific results, which change
  constantly.
- **Generous timeouts.** Each live `it` carries an explicit `NETWORK_TIMEOUT_MS`
  timeout (30,000 ms). The offline checks inside the harness need no timeout.

## Test Layout

`test/` holds the specs and the shared harness/fixtures. A spec may cover an entire
surface in **one file** — offline checks (e.g. registration, error shaping) and live
calls side by side — rather than a deep mirror of the source tree:

```
test/
  TestHelper.ts                 shared harness + fixtures + helpers (not a spec)
  <Unit>.test.ts                offline checks + live per-operation calls
```

Specs end in `.test.ts`; support files (the shared harness/fixtures) do not, so the
glob skips them. Each spec is one `describe('<Unit>')` suite with nested `describe(...)`
blocks per behavior or operation.

## Shared Fixtures and Helpers

`test/TestHelper.ts` holds the **harness builder**, the parser, and the fixtures
shared across specs — prefer it over hand-rolling values in each test:

- **`connectTestClient()`** — spins up a `DuckPoacherServer`, links it to an MCP
  `Client` over an in-memory transport pair, connects both, and returns
  `{ client, close }`; call `close()` to tear them down.
- **`parseToolResult(result)`** — asserts a tool result is a successful single text
  block and returns its parsed JSON payload (a `PaginatedPayload`).
- **`assertCrossPageSnapshot(client, toolName, identity)`** — exercises pagination:
  fetches page 1, then page 2 when one exists, asserts both pages share the same
  cached snapshot (identical `totalResults`), and verifies page 2 repeats none of
  page 1's results. It is data-adaptive: if the live dependency caps at a single page
  (`hasMore` is false) it no-ops, and exercises real pagination when more pages
  arrive — no test change needed. `identity` extracts a result's dedup key (e.g.
  `entry.url` for web results).
- **`TEST_QUERY`** — a stable, result-rich query (`'node.js'`) so live calls return
  reliably non-empty results across runs.
- **`NETWORK_TIMEOUT_MS`** — the per-request budget (`30_000` ms) passed as the `it`
  timeout option.
- **`assertHttpUrl(value, label)`** — asserts a value is a non-empty absolute http(s)
  URL (regex: `/^https?:\/\//`), used to validate every returned URL.
- **`PaginatedPayload`** (exported `type`) — the pagination envelope returned by
  `parseToolResult`: `page`, `pageSize`, `totalResults`, `totalPages`, `hasMore`, and
  the `results` array.

The harness owns a **live client connection**, so specs that use it set it up in a
`before` hook and tear it down in an `after` hook that calls `close()` — this is the
one resource the suite owns. The plain fixtures and assertions (`TEST_QUERY`,
`NETWORK_TIMEOUT_MS`, `assertHttpUrl`) are not resources and need no cleanup.

## Conventions

- **Structure:** `describe` per unit with a nested `describe` per behavior or
  operation, and an `it` per case.
- **Lifecycle:** build the harness in `before`, tear it down in `after` via `close()`;
  the harness connection is the one resource the suite owns.
- **Given/When/Then:** each `it` body carries `// Given`, `// When`, `// Then`
  comments narrating the scenario. Follow this — it is consistent across the suite.
- **Network timeout:** pass `{ timeout: NETWORK_TIMEOUT_MS }` as the `it` options
  argument on any spec that reaches the live dependency; omit it on the offline checks.
- **Shape assertions:** use `assert.match` for URLs and patterns, `assertHttpUrl` for
  returned URLs, and `assert.ok`/`assert.equal`/`assert.deepEqual` for array shape and
  registration/field checks — assert on shape, never on live result content.

## Type-Checking the Test Tree

The build `tsconfig.json` has `rootDir: ./src` and must not see test files, so the
test tree is type-checked through a separate **`tsconfig.test.json`** that extends it,
sets `rootDir: .` / `noEmit: true`, and widens `include` to `src` + `test`.

ESLint wires the test tree to that config via `eslint.config.mjs` and **disables
`@typescript-eslint/no-floating-promises` for `test/**`** — `node:test`'s
`describe`/`it` return promises that must not be awaited at the call site, so the rule
would be all false positives there. The rule stays **on** in `src/`, where an
unawaited promise is a real defect. Keep test code inside this carve-out; don't
disable the rule in `src/`.
