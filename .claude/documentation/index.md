# Documentation Index

## [code-style.md](code-style.md)

Naming, OOP, enum, accessibility, formatting, and import conventions, plus the ESLint/dprint rules that enforce them.

**Use when:**

- Writing new code or reviewing for consistency
- Deciding naming, access modifiers, or import/`.ts` extension style
- Resolving an ESLint or dprint formatting issue

## [testing.md](testing.md)

How the test suite is structured and run: the node:test runner via tsx, the in-memory transport harness that wires the unit under test to a client in-process, the live calls that still reach the real external dependency, shared fixtures, and conventions.

**Use when:**

- Writing or running tests, or diagnosing a failing live spec
- Setting up the in-memory client harness or its `before`/`after` teardown
- Adding a fixture or the `tsconfig.test.json` / ESLint carve-out for the test tree
