---
title: "Code Style & Conventions"
description: "Source of truth for how source code is written in this repo: object-oriented-by-default, one-class/one-type-per-file, no module-level state, explicit types and access modifiers, JSDoc declaration comments, naming, imports, and the ESLint/dprint rules that enforce them."
category: "guide"
tags: ["code-style", "conventions", "oop", "value-objects", "types", "comments", "jsdoc", "naming", "eslint", "dprint"]
last_updated: "2026-06-21T22:40:19Z"
related_docs: ["testing.md"]
---

# Code Style & Conventions

**Source of truth** for how source code is written here. Identifier names in
examples are illustrative; the rules are the point.

## Table of Contents
1. [Tooling Split: dprint vs ESLint](#tooling-split-dprint-vs-eslint)
2. [Object-Oriented by Default](#object-oriented-by-default)
3. [Naming](#naming)
4. [One Class Per File (and one file per type)](#one-class-per-file-and-one-file-per-type)
5. [Closed String Sets (no TS `enum`)](#closed-string-sets-no-ts-enum)
6. [Explicit Access Modifiers](#explicit-access-modifiers)
7. [Private Fields and Constructor Properties](#private-fields-and-constructor-properties)
8. [Explicit Types Where the Type Isn't Obvious](#explicit-types-where-the-type-isnt-obvious)
9. [No Module-Level State](#no-module-level-state)
10. [Imports and `.ts` Extensions](#imports-and-ts-extensions)
11. [Formatting Rules](#formatting-rules)
12. [Comments](#comments)

---

## Tooling Split: dprint vs ESLint

**dprint owns layout, ESLint owns correctness and conventions.**
`eslint-config-prettier` is loaded last in `eslint.config.mjs` to disable ESLint's
layout rules so the two never fight (no Prettier is installed; it's just the disable
list). Run both on every change — `npm run format` then `npm run lint`.

## Object-Oriented by Default

All logic lives in **classes and their methods** — no free-standing functions
implementing behavior in `src/`. Pure transformations become **value objects** that
do their work in the constructor and expose `readonly` results: a `Page` slices the
result set and computes its pagination metadata on construction
(`new Page(results, page, pageSize)`); a cached row is a `CacheEntry` that answers
`isExpired(now, ttlMs)` instead of being a bare record the cache inspects. Behavior
travels with its data (tell, don't ask).

**Exempt** from the OOP rules (this section, one-class-per-file, no-module-level-state):

- **Entry points** — `src/cli.ts` (bootstrap) and `src/index.ts` (barrel) may use
  top-level constants and a `main()`; don't wrap them in a class.
- **Tests** — `node:test`'s `describe`/`it` and `test/TestHelper.ts` are
  function/fixture style (see `testing.md`).

## Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Folders | lowercase, hyphenated for multiword | `src/`, `cache/`, `result/`, `search/` |
| Class files | PascalCase, match the class | `Service.ts`, `ApiClient.ts` |
| Classes | PascalCase | `Service`, `ApiClient`, `SearchResult` |
| Methods / locals | camelCase | `generateToken`, `fetchResults` |
| Private fields | `_camelCase` | `_parser`, `_client`, `_cache` |
| Constants / config fields | UPPER_SNAKE_CASE | `OPTION_NAMES`, `TOKEN_REGEX` |

Acronyms are ordinary words in identifiers — `Api`, `Url`, `Json`, `Id`, never
all-caps; in particular spell the protocol `Http` (`HttpError`, `HttpClient`), never
`HTTP`. This applies to identifiers only: write acronyms normally in prose and
strings, and keep upstream spellings for external names (`URLSearchParams`, a
dependency's published `HttpMethod`).

## One Class Per File (and one file per type)

Each file has exactly **one** primary class as its default export, filename matching
the class. Enforced:

```js
'max-classes-per-file': ['error', { ignoreExpressions: true, max: 1 }]
```

`ignoreExpressions` allows small inline/anonymous classes. `src/index.ts` (the
barrel) only re-exports, so it's exempt.

**One named type per file, too** — every `type` alias or `interface` gets its own
file (ESLint doesn't count these, but the convention holds). Prefer a **class** when
the shape carries behavior or is constructed (value objects); use a plain `type`
only for shapes that can't or needn't be a class (a `z.infer`, a union, a small data
record). **Don't inline structural object types** — name a shape like
`{ type: 'text'; text: string }` as its own `type` (e.g. `TextContent`), even if used
once. Only irreducible constructs (a one-off tuple, a `Parameters<…>` lookup) stay
inline.

## Closed String Sets (no TS `enum`)

`enum` is **banned**. Use a string-literal union:

```ts
export type Size = 'Small' | 'Medium' | 'Large';
```

When you need a runtime value per member, use the const-object pattern (value + a
same-named type):

```ts
const HttpMethod = {
  GET: 'GET',
  POST: 'POST'
} as const;
type HttpMethod = typeof HttpMethod[keyof typeof HttpMethod];
export { HttpMethod };
```

Enforced — and this keeps enums tree-shakeable with no emitted object or reverse map:

```js
'no-restricted-syntax': ['error', {
  selector: 'TSEnumDeclaration',
  message: 'Use the const-object enum pattern instead of `enum` (see code-style.md).'
}]
```

## Explicit Access Modifiers

Every member — including the constructor — declares `public`, `private`, or
`protected`. Enforced:

```js
'@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }]
```

Config constants and owned collaborators are `private (static) readonly`; reach for
`protected` only for a genuine subclass seam.

## Private Fields and Constructor Properties

State lives in `private` `_`-prefixed fields (`private readonly _client = new
ApiClient()`). Immutable public data uses **constructor parameter properties**, not a
field plus a getter — value objects are the canonical case:

```ts
public constructor(
  public readonly title: string,
  public readonly url: string
) {}
```

No getters/setters by default; add them only for computed access or controlled
mutation.

## Explicit Types Where the Type Isn't Obvious

Annotate wherever the type isn't visible from the right-hand side: fields and
constants (including scalars — `private static readonly CACHE_MAX_ENTRIES: number =
100`) and non-obvious locals/parameters (`const keys: string[] | undefined = …`).
Methods always declare a return type. Two cases stay inferred:

- A `new ClassName(...)` initializer — the type is written in the `new`.
- A **zod schema** (`z.object({ … })`) — its real type is an unwieldy, version-brittle
  `z.ZodObject<…>`, and widening it breaks `.shape` and `registerTool`'s argument
  inference. Leave it inferred; derive what you need with `z.infer`.

## No Module-Level State

No top-level `const`/`let`/`var`/`function` in `src/` (entry points exempt — see
[Object-Oriented by Default](#object-oriented-by-default)). Constants become
`private static readonly` members (UPPER_SNAKE_CASE); a zod schema is held the same
way and used as `ClassName.SCHEMA.shape`; behavior becomes a method. A module is just
imports plus one class (or one named type).

## Imports and `.ts` Extensions

Relative imports include the **`.ts`** extension:

```ts
import ApiClient from './api/ApiClient.ts';
import type SearchResult from './api/SearchResult.ts';
```

This works because `tsconfig.json` sets `allowImportingTsExtensions` +
`rewriteRelativeImportExtensions` (the compiler rewrites `.ts` → `.js` on emit). Also:

- `verbatimModuleSyntax` is on — use `import type` / `export type` (or inline
  `{ type X }`) for type-only imports.
- Tests use the `node:` prefix for built-ins (`node:test`, `node:assert/strict`).
- Classes are default exports; the barrel re-exports them by name
  (`export { default as Service }`) and shared types with `export type`.

## Formatting Rules

From `dprint.json`:

| Setting | Value |
|---------|-------|
| Indentation | **tabs**, width 2 |
| Line width | 120 |
| Quotes | prefer single |
| Semicolons | required |
| Trailing commas | never (except multi-line parameters: `onlyMultiLine`) |
| `nextControlFlowPosition` | next line (`else`/`catch` on their own line) |
| Line endings | LF |

dprint also formats JSON.

## Comments

A comment documenting a **declaration** (class / named `type` / `interface` /
method) is a **short** `/** … */` JSDoc directly above it — one to two lines on
**what**, not how. Every class has one; types/methods get one when they need
explaining. JSDoc (not `//`) so it surfaces on hover at use sites.

**Inline notes stay plain `//`** — body or single-parameter notes, sparse, explaining
*why*, not *what* (e.g. `// Order is important` above a load-bearing array). Tests and
`TestHelper.ts` use `/** … */` for fixtures. `removeComments: true` strips all
comments from build output, so they exist only for source readers.
