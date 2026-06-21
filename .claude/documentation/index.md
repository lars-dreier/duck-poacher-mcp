# Documentation Index

## [code-style.md](code-style.md)

Naming, OOP, enum, accessibility, formatting, and import conventions, plus the ESLint/dprint rules that enforce them.

**Use when:**

- Writing new code or reviewing for consistency
- Deciding naming, access modifiers, or import/`.ts` extension style
- Resolving an ESLint or dprint formatting issue

## [testing.md](testing.md)

How the test suite is structured and run: the node:test runner via tsx, the live integration specs against an external dependency, the offline unit specs, shared fixtures, and conventions.

**Use when:**

- Writing or running tests, or diagnosing a failing live-integration spec
- Adding a fixture or deciding what to assert against a drifting external response
- Setting up the `tsconfig.test.json` / ESLint carve-out for the test tree
