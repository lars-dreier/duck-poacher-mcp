# Documentation Index

## [code-style.md](code-style.md)

Naming, OOP/value-object, enum, accessibility, formatting, and import conventions, plus the ESLint/dprint rules that enforce them.

**Use when:**

- Writing new code or reviewing for consistency
- Deciding naming, access modifiers, or import/`.ts` extension style
- Resolving an ESLint or dprint formatting issue

## [testing.md](testing.md)

How the test suite is structured and run: the node:test runner via tsx, the in-memory transport harness wiring `DuckPoacherServer` to a client in-process, the live calls that still reach DuckDuckGo, the shared fixtures/helpers in `TestHelper.ts`, and conventions.

**Use when:**

- Writing or running tests, or diagnosing a failing live spec
- Setting up the in-memory client harness or using `connectTestClient`/`parseToolResult`/`assertCrossPageSnapshot`
- Adding a fixture or the `tsconfig.test.json` / ESLint carve-out for the test tree
