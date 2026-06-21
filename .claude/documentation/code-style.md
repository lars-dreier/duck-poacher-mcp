---
title: "Code Style & Conventions"
description: "Naming, OOP, enum, accessibility, formatting, and import conventions used throughout the source, and the ESLint/dprint rules that enforce them."
category: "guide"
tags: ["code-style", "conventions", "naming", "eslint", "dprint", "oop"]
last_updated: "2026-06-21T00:00:00Z"
related_docs: ["testing.md"]
---

# Code Style & Conventions

The examples below are illustrative — generic class and identifier names stand in
for whatever this project actually contains. The conventions and the rules that
enforce them are the point.

## Table of Contents
1. [Tooling Split: dprint vs ESLint](#tooling-split-dprint-vs-eslint)
2. [Naming](#naming)
3. [One Class Per File](#one-class-per-file)
4. [Closed String Sets (no TS `enum`)](#closed-string-sets-no-ts-enum)
5. [Explicit Access Modifiers](#explicit-access-modifiers)
6. [Private Fields and Constructor Properties](#private-fields-and-constructor-properties)
7. [Imports and `.ts` Extensions](#imports-and-ts-extensions)
8. [Formatting Rules](#formatting-rules)
9. [Comments](#comments)

---

## Tooling Split: dprint vs ESLint

The project draws a hard line: **dprint owns layout, ESLint owns correctness and
project conventions.** `eslint-config-prettier` is loaded last in
`eslint.config.mjs` specifically to disable every ESLint layout rule so the two
never fight. (Despite the name, no Prettier is installed — `eslint-config-prettier`
is just the canonical list of layout-rule disables; dprint is the only formatter.)
When you change code, run both (`npm run format` then `npm run lint`) — a passing
lint does not imply correct formatting and vice versa.

## Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Folders | lowercase, hyphenated for multiword | `src/`, `web/`, `image-search/` |
| Class files | PascalCase, match the class | `Service.ts`, `ApiClient.ts`, `ResponseParser.ts` |
| Classes | PascalCase | `Service`, `ApiClient`, `ResponseParser`, `SearchResult` |
| Methods / locals | camelCase | `generateToken`, `fetchResults`, `createSearchUrl` |
| Private fields | `_camelCase` | `_parser`, `_client`, `_cache` |
| Constants (incl. `private readonly` config fields) | UPPER_SNAKE_CASE | `OPTION_NAMES`, `DEFAULT_HEADERS`, `TOKEN_REGEX`, `SEARCH_URL_REGEX` |

**Acronyms are treated as ordinary words in identifiers — never all-caps.**
Capitalize only the first letter and lowercase the rest: `Api` not `API`, `Url`
not `URL`, `Json` not `JSON`, `Id` not `ID`. So a config type reads
`ApiOptions`, and a helper is `assertHttpUrl`. A proper noun or brand name that a
class is named after is written out in full as it is spelled, which sidesteps the
acronym rule entirely.

**Spell the protocol `Http`, never `HTTP`.** This is the most common case of the
rule above: every class, file, and identifier uses `Http...` (e.g. `HttpError`,
`HttpClient`), never `HTTPError`. A firm project convention.

The rule applies to identifiers only. In prose, comments, and string literals,
write acronyms normally (`HTTP GET`, "the live API"). Names that come from
outside the project keep their upstream spelling: Node/web globals
(`URLSearchParams`, `JSON`, `XMLHttpRequest`) and any third-party package's
exports (e.g. a dependency that publishes `HttpMethod`) are used as published.

## One Class Per File

Each file exports exactly **one** primary class as its default export, and the
filename matches that class. Enforced by ESLint:

```js
'max-classes-per-file': ['error', { ignoreExpressions: true, max: 1 }]
```

`ignoreExpressions` allows small inline/anonymous classes without tripping the
rule. The public barrel `src/index.ts` is the one file with many exports — it
only re-exports, it defines nothing. Internal shapes declared with `interface`
(e.g. a parser's private `ResponseShape` describing the JSON it reads) may
co-exist with their class in one file because they are `interface`s, not classes,
so the rule does not count them. The same goes for `type` aliases (e.g. option
types living alongside the client that consumes them) — they are not classes.

## Closed String Sets (no TS `enum`)

TypeScript `enum` is **banned**. For a closed set of string values, this project
uses a plain **string-literal union type** — no runtime object at all:

```ts
export type Size = 'Small' | 'Medium' | 'Large';
export type Layout = 'Square' | 'Tall' | 'Wide';
```

When you genuinely need a **runtime value** for each member (e.g. to iterate or
reference by name), use the const-object pattern instead, exporting a value and
a same-named type:

```ts
const HttpMethod = {
  GET: 'GET',
  POST: 'POST'
  // ...
} as const;
type HttpMethod = typeof HttpMethod[keyof typeof HttpMethod];
export { HttpMethod };
```

Either way, no `enum`. Enforced by ESLint:

```js
'no-restricted-syntax': ['error', {
  selector: 'TSEnumDeclaration',
  message: 'Use the const-object enum pattern instead of `enum` (see code-style.md).'
}]
```

This keeps enums tree-shakeable with no emitted enum object and no reverse
mappings.

## Explicit Access Modifiers

Every class member declares `public`, `private`, or `protected` explicitly —
including the constructor. Enforced:

```js
'@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }]
```

For example, in a facade the owned implementation collaborators are
`private readonly` fields (`_client`, `_parser`) and the entry points are
`public` (`fetchResults`, `search`); configuration constants are
`private readonly` (`OPTION_NAMES`, `DEFAULT_HEADERS`, `TOKEN_REGEX`,
`SEARCH_URL_REGEX`); and helpers that build URLs or headers are `private`
(`createSearchUrl`, `createOptionsHeader`). `protected` is available for subclass
seams; reach for it only when a subclass genuinely needs the member.

## Private Fields and Constructor Properties

State is held in `private` `_`-prefixed fields. A facade owning its implementation
collaborator, and a collaborator owning its parser, are the canonical examples:

```ts
// a facade owns its implementation clients
private readonly _client = new ApiClient();

// a client owns its parser
private readonly _parser = new ResponseParser();
```

Immutable public data uses **constructor parameter properties** rather than a
field plus a getter — value objects are the canonical case:

```ts
public constructor(
  public readonly title: string,
  public readonly url: string,
  public readonly description: string
) {}
```

Getters/setters are not used by default; reach for them only when you need
computed access or controlled mutation. Fields are initialized at declaration
with explicit types where inference would be unclear.

## Imports and `.ts` Extensions

Relative imports include the **`.ts`** extension:

```ts
import ApiClient from './api/ApiClient.ts';
import type SearchResult from './api/SearchResult.ts';
```

(and from within a subdirectory, e.g. inside a parser: `import SearchResult from
'./SearchResult.ts';`). This works because `tsconfig.json` sets
`allowImportingTsExtensions` + `rewriteRelativeImportExtensions` — the compiler
rewrites `.ts` to `.js` on emit, so no post-processor is needed and `tsc -w`
works. Other conventions:

- `verbatimModuleSyntax` is on, so use `import type` / `export type` (or inline
  `{ type X }`) for type-only imports — e.g. `import type SearchResult` when a
  class is used only as a return type, and `src/index.ts` re-exporting option
  types with `export type`.
- Node built-ins are imported as namespaces in `src/`: `import * as http from
  'http'`. Test files use the `node:` prefix, e.g. `node:test`,
  `node:assert/strict`.
- Default export per file for classes; the barrel `src/index.ts` re-exports them
  under their names (`export { default as Service }`) and re-exports any shared
  types with `export type`.

## Formatting Rules

From `dprint.json`:

| Setting | Value |
|---------|-------|
| Indentation | **tabs**, width 2 |
| Line width | 120 |
| Quotes | prefer single |
| Semicolons | prefer (required) |
| Trailing commas | never (except multi-line parameters: `onlyMultiLine`) |
| `nextControlFlowPosition` | next line (`else`/`catch` on their own line) |
| Line endings | LF |

The "next line" control flow produces the project's distinctive `}` then
`else {` / `catch {` on separate lines. dprint also formats JSON.

## Comments

The `src/` classes are **not** JSDoc-documented — the code carries no `/** ... */`
class summaries. Comments are sparse and reserved for non-obvious decisions —
for example, a `// Order is important` note above an array whose element order is
load-bearing, or an inline note explaining why a value must be scraped rather
than constructed. Explain *why*, not *what*.

Test files and any shared `TestHelper.ts` do use `/** ... */` to explain
fixtures. Either way, `removeComments: true` in `tsconfig.json` strips comments
from build output, so they exist only for source readers. If you add explanatory
comments, follow the existing bar.
