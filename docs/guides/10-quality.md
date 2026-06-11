# Quality

This guide covers the quality toolchain in the doors monorepo: how Biome enforces formatting, lint, and naming conventions, how TypeScript strictness prevents runtime bugs, and how the CI pipeline gates changes. Follow these practices to keep the codebase consistent and maintainable.

---

## 1. Overview

The project uses two layers of static analysis:

| Layer | Tool | What it enforces |
|-------|------|------------------|
| Format + lint | [Biome](https://biomejs.dev) | Code formatting, import ordering, naming conventions, explicit return types, import boundaries, security rules |
| Types | TypeScript | Type safety, strict null checks, indexed access safety, module syntax correctness |

Both layers must pass with zero diagnostics before code enters the main branch. The root `package.json` provides convenience scripts to run each layer:

- `bun run check` — format + lint + safe auto-fixes
- `bun run check:unsafe` — same plus unsafe fixes (e.g. adding `node:` protocol to Node built-ins)
- `bun run ci` — read-only Biome check (fails on any issue, no auto-fix)
- `bun run typecheck` — TypeScript type-checking across all workspaces

---

## 2. Biome configuration

Biome replaces Prettier and ESLint. Its configuration lives in the root [`biome.json`](/biome.json).

### 2.1 File scope

Biome processes all files under `apps/` and `packages/`, plus root `*.json` files and `AGENTS.md`. It ignores:

- `apps/mobile/ios/` and `apps/mobile/android/` (native platform directories)
- `apps/mobile/global.css` (processed separately)

Unknown file types are skipped gracefully (`ignoreUnknown: true`). The VCS integration reads `.gitignore` so files excluded from Git are also excluded from Biome.

### 2.2 Formatter

| Setting | Value |
|---------|-------|
| Indent style | Space |
| Indent width | 2 |
| Line width | 100 |
| Quotes (JS/TS) | Single |
| JSX quotes | Double |
| Semicolons | As needed (omit when unnecessary) |
| Trailing commas | All (including trailing commas where valid) |
| Arrow parens | Omitted for single parameters (`x => x`) |
| Brackets | No spaces inside, closing bracket on same line |

Formatter overrides are minimal. The `apps/mobile/src/components/ui/` directory has formatting disabled because those files follow shadcn conventions.

### 2.3 Lint rules

All recommended rules are enabled. The following groups have additional project-specific rules:

#### Correctness

- `noUnusedFunctionParameters` — error
- `noUnusedImports` — error
- `noUnusedVariables` — error
- `useExhaustiveDependencies` — error (React hooks)
- `useHookAtTopLevel` — error

#### Nursery (stable enough to enforce)

- `noFloatingPromises` — error (every Promise must be awaited or explicitly voided)
- `useExplicitReturnType` — error (every exported function must declare its return type; non-exported functions may omit it)

#### Style

- `noDefaultExport` — error (use named exports; exceptions for config files and `App.tsx`)
- `noEnum` — error (use union types or `const` objects instead)
- `noNonNullAssertion` — warn (prefer narrowing; `!` is a last resort)
- `useBlockStatements` — error (curly braces always, even for single-line bodies)
- `useConsistentArrayType` — error (use `T[]`, not `Array<T>`)
- `useExportType` — error (re-export types with `export type`)
- `useFilenamingConvention` — error (camelCase, PascalCase, or matching export name)
- `useImportType` — error (import types with `import type`)
- `useNamingConvention` — error (consistent casing: camelCase for variables/functions, PascalCase for classes/components, UPPER_CASE for constants)
- `useNodejsImportProtocol` — error (use `node:fs`, `node:path`, etc.)
- `useSelfClosingElements` — error (JSX elements without children)
- `useShorthandFunctionType` — error (use `() => void`, not `{ (): void }`)

#### Suspicious

- `noArrayIndexKey` — error (use stable IDs for React keys)
- `noDoubleEquals` — error (always `===` / `!==`)
- `noExplicitAny` — error (use `unknown` instead of `any`)
- `noTsIgnore` — error (use `@ts-expect-error` with a reason instead)
- `useAwait` — error (don't return dangling promises; `return promise` is allowed only when callers expect a Promise)

#### Security

- `noGlobalEval` — error
- `noSecrets` — error (detects accidentally committed credentials)

#### Performance

- `noBarrelFile` — error (barrel re-export files are forbidden; except `packages/api/src/index.ts` which is the public API surface)

### 2.4 Import organization

Biome auto-organizes imports on save into these groups, separated by blank lines:

1. Node built-ins (`node:fs`, `node:path`, etc.)
2. Third-party packages (`react`, `elysia`, `@tanstack/react-query`, etc.)
3. Internal `@doors/*` packages
4. Relative imports (`./`, `../`)

Run `bun run check` to apply import organization across all files.

---

## 3. Running checks

### 3.1 Full format + lint with safe fixes

```bash
bun run check
```

This runs `biome check --write .` which applies formatting fixes and safe lint auto-fixes. Safe fixes never change runtime behavior — they fix whitespace, add/remove parentheses, organize imports, and so on.

### 3.2 With unsafe fixes

```bash
bun run check:unsafe
```

Unsafe fixes may change semantics. The most common unsafe fix in this project is adding the `node:` protocol prefix to Node.js module imports (`fs` -> `node:fs`). Review the diff after running this command before committing.

### 3.3 Read-only CI check

```bash
bun run ci
```

This runs `biome ci .` which performs all checks in read-only mode. It never modifies files and exits with a non-zero status code on any issue. This is the command used in CI/CD pipelines.

### 3.4 TypeScript type-checking

```bash
bun run typecheck
```

Runs `tsc --noEmit` across all workspaces. The command uses `--project` per workspace to pick up each workspace's `tsconfig.json` (which extends `tsconfig.base.json`).

---

## 4. Key Biome rules in practice

### 4.1 Filename convention

Files must follow one of these patterns:

- **camelCase**: `useLocations.ts`, `mapHelpers.ts`, `apiClient.ts`
- **PascalCase**: `MapView.tsx`, `PersonCard.tsx`, `App.tsx`
- **Export name match**: if a file wraps a single named export, the filename must match the export name

Config files (`*.config.js`, `*.config.ts`, `metro.config.js`) are exempt from this rule.

### 4.2 No default exports

Every export must be named. This makes imports predictable and refactoring tools more reliable.

```typescript
// Correct
export function formatDate(date: Date): string { ... }

// Correct
export const LOCATION_TYPES = ['office', 'cafe', 'park'] as const;

// Wrong — Biome will error
export default function formatDate(date: Date): string { ... }
```

Exceptions:
- `apps/mobile/App.tsx` (React Native entry point expects a default export)
- Config files (`*.config.js`, `postcss.config.mjs`, etc.)
- Files under `apps/mobile/src/components/ui/` (shadcn conventions)

### 4.3 Import type vs. value imports

TypeScript with `verbatimModuleSyntax` requires explicit `type` qualifiers for type-only imports. Biome enforces this with `useImportType` and `useExportType`.

```typescript
// Correct — type-only import
import type { Location } from '@doors/api';

// Correct — mixed import
import { fetchLocations, type Location } from '@doors/api';

// Wrong — Biome will error
import { Location } from '@doors/api';
```

### 4.4 Non-null assertion (warn only)

The `!` operator generates a warning, not an error. This allows pragmatic use when TypeScript's narrowing is insufficient, but prefer narrowing:

```typescript
// Prefer this
const name = person.name ?? 'Unknown';

// Or this with type narrowing
if (person.name) {
  console.log(person.name);
}

// Last resort — generates a warning
const name = person.name!;
```

### 4.5 Naming convention

Biome enforces consistent naming with `useNamingConvention`:

- Variables, functions, parameters, methods: `camelCase`
- Classes, components, types, interfaces: `PascalCase`
- Constants: `UPPER_CASE` (for top-level `const` declarations initialized with literal or `as const` values)
- Private properties: prefix with `_` (e.g. `_cache`)

Files under `apps/mobile/src/components/ui/` are exempt from naming convention enforcement.

### 4.6 Explicit return types

Every exported function must declare its return type. Biome enforces this with `useExplicitReturnType`.

```typescript
// Correct
export function fetchPerson(id: string): Promise<Person> { ... }

// Wrong — Biome will error
export function fetchPerson(id: string) { ... }
```

This rule does not apply to:
- Non-exported functions (internal helpers can omit return types)
- Config files and `index.js` files

### 4.7 No floating promises

Every Promise must be handled: either awaited, returned, or explicitly voided.

```typescript
// Correct — awaiting
await saveData(data);

// Correct — returning to caller
return saveData(data);

// Correct — explicit void
void trackEvent('click');

// Wrong — Biome will error
saveData(data);
```

### 4.8 No explicit `any`

Use `unknown` when the type is genuinely not known. Use proper generics or type narrowing instead of `any`.

```typescript
// Correct
function parseJson(input: string): unknown {
  return JSON.parse(input);
}

// Wrong — Biome will error
function parseJson(input: string): any {
  return JSON.parse(input);
}
```

---

## 5. Overrides

Biome applies relaxed rules to specific files that follow external conventions.

### 5.1 Config files

Files matching `**/*config.js`, `**/index.js`, and `**/index.web.js`:

- Default exports allowed (`noDefaultExport: off`)
- Filename convention relaxed (`useFilenamingConvention: off`)
- Node protocol optional (`useNodejsImportProtocol: off`)
- Explicit return types optional
- Barrel files allowed

### 5.2 App.tsx

`apps/mobile/App.tsx` allows a default export because React Native's `AppRegistry.registerComponent` expects one.

### 5.3 UI components

Files under `apps/mobile/src/components/ui/` follow shadcn conventions:

- Default exports allowed
- Filename and naming conventions relaxed
- Block statement requirement relaxed
- Explicit return types optional
- Formatting disabled (these files are vendored)

### 5.4 global.css

`apps/mobile/global.css` has linting disabled entirely. It is processed by PostCSS and Tailwind, not by Biome.

### 5.5 API barrel

`packages/api/src/index.ts` is the public API surface and is allowed to be a barrel file (`noBarrelFile: off`).

---

## 6. Import boundaries

The monorepo enforces strict import boundaries to prevent architecture violations.

### 6.1 Mobile must use the API client

Files inside `apps/mobile/**` must not import from `@doors/server` directly. They must go through `@doors/api`, which wraps the Eden Treaty client.

```typescript
// Correct
import { api, type Person } from '@doors/api';

// Wrong — Biome will error
import { app } from '@doors/server';
```

This ensures the mobile layer only communicates with the server through the HTTP API, preventing accidental tight coupling.

### 6.2 Backend must not import mobile

Files in `packages/api/**` and `apps/server/**` must not import anything from `apps/mobile/**`.

```typescript
// Wrong — Biome will error
import { MapView } from 'apps/mobile/src/components/MapView';
```

This enforces a clean dependency graph: backend packages know nothing about the frontend.

---

## 7. TypeScript strictness

The base TypeScript configuration in [`tsconfig.base.json`](/tsconfig.base.json) enables every strict check available.

### 7.1 Core settings

| Setting | Value | Effect |
|---------|-------|--------|
| `strict` | `true` | Enables all strict family flags (`strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, etc.) |
| `noUncheckedIndexedAccess` | `true` | Accessing an index signature returns `T \| undefined`; forces narrowing before use |
| `exactOptionalPropertyTypes` | `true` | `prop?: string` means the property can be `undefined` only if it is absent or explicitly set to `undefined`; `prop: string \| undefined` is different from `prop?: string` |
| `noImplicitOverride` | `true` | Method overrides in subclasses must use the `override` keyword |
| `verbatimModuleSyntax` | `true` | Type-only imports/exports must use `import type` / `export type`; Biome enforces the same at the lint level |
| `isolatedModules` | `true` | Every file is treated as a separate module; prevents const-enum exports and other cross-file type magic |
| `skipLibCheck` | `true` | Skip type checking of `.d.ts` files in `node_modules` (saves compilation time) |
| `esModuleInterop` | `true` | Enables default imports from CJS modules |

### 7.2 `noUncheckedIndexedAccess` in practice

This is the most impactful setting for day-to-day development. When you access an object by a string key, TypeScript requires you to handle the `undefined` case.

```typescript
const nameMap: Record<string, string> = {};

// TypeScript error — name may be undefined
const name = nameMap['key'].toUpperCase();

// Correct — narrow first
const key = nameMap['key'];
if (key) {
  console.log(key.toUpperCase());  // key is string here
}

// Also correct — use optional chaining with nullish coalescing
const name = nameMap['key']?.toUpperCase() ?? 'FALLBACK';
```

### 7.3 `exactOptionalPropertyTypes` in practice

```typescript
interface Config {
  timeout?: number;
}

const config: Config = { timeout: undefined };  // OK — optional property explicitly set to undefined

// But this works too (absence is the same as undefined for optional props)
const config2: Config = {};  // OK

// This is a type error if the property expects undefined but the type says it's optional
function setConfig(c: Config) {}
setConfig({ timeout: 3000 });  // OK
```

### 7.4 `verbatimModuleSyntax`

This setting prevents TypeScript from eliding type imports behind the scenes. It forces you to write `import type` explicitly, which makes the intent clear and prevents bundlers from including unused imports.

```typescript
// Correct — type-only
import type { Response } from 'express';

// Correct — value import
import express from 'express';

// Wrong — TypeScript will error
import { Response } from 'express';  // Response is a type, needs `type` qualifier
```

### 7.5 Path aliases

The base config defines workspace-aware path aliases:

- `@doors/api` -> `packages/api/src/index.ts`
- `@doors/api/*` -> `packages/api/src/*`
- `@doors/server` -> `apps/server/src/app.ts`
- `@doors/server/*` -> `apps/server/src/*`

These are used instead of deep relative imports. Every workspace's `tsconfig.json` extends the base and inherits these aliases.

---

## 8. Docstring requirements

Biome does not enforce documentation, but the project's quality bar (defined in `AGENTS.md`) requires it.

### 8.1 Exported declarations must have JSDoc

Every exported function, component, constant, and type must have a `/** ... */` docstring that describes:

- What the export does
- Any non-obvious behavior (side effects, error cases, performance characteristics)

```typescript
/**
 * Fetches people for a given workspace, filtered by the optional search term.
 * Results are cached for 30 seconds via React Query's staleTime.
 * Returns an empty array if the API is unreachable.
 */
export function usePeople(workspaceId: string, search?: string): UseQueryResult<Person[]> {
  // ...
}
```

### 8.2 Inline step comments

Inside function bodies, each logical step must have a short line comment explaining what it does. These are single-line `//` comments.

```typescript
export function buildGeoJsonResponse(people: Person[]): FeatureCollection {
  // Filter out people without valid coordinates
  const withCoords = people.filter(p => p.lng && p.lat);

  // Map each person to a GeoJSON Feature
  const features = withCoords.map(person => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [person.lng, person.lat] },
    properties: { id: person.id, name: person.displayName },
  }));

  // Wrap in FeatureCollection
  return { type: 'FeatureCollection', features };
}
```

### 8.3 What to skip

Boilerplate generated by scaffolding tools (e.g. default React Native test stubs, `metro.config.js`, `postcss.config.mjs`) does not need docstrings unless you are actively editing them.

---

## 9. CI pipeline

### 9.1 Pre-merge checks

Every pull request must pass two checks:

1. **`bun run ci`** — Biome in read-only mode. Zero formatting issues, zero lint errors, zero warnings (warnings are allowed but treated as soft signals).
2. **`bun run typecheck`** — TypeScript type-checks across all workspaces with zero errors.

### 9.2 How the CI commands work

```bash
# Read-only Biome check (CI)
bun run ci
# Equivalent to: biome ci .
# Exits non-zero on any issue, never modifies files

# TypeScript check (CI)
bun run typecheck
# Runs tsc --noEmit per workspace using bun's --filter
# Equivalent to: bun run --filter '*' typecheck
```

### 9.3 Local pre-commit workflow

Before committing, run:

```bash
bun run check       # Auto-fix formatting and lint
bun run typecheck   # Verify types
```

If you want to be extra thorough:

```bash
bun run check:unsafe  # Also apply unsafe fixes (review the diff!)
bun run ci            # Verify zero diagnostics (like CI)
bun run typecheck     # Verify types (again, after changes)
```

### 9.4 No CI for documentation-only changes

If you only edit markdown files or other non-TypeScript/non-JavaScript files, the CI checks are still valid but will pass trivially (Biome skips files it doesn't recognize, and type-checking targets only `.ts`/`.tsx` files).

---

## 10. Common pitfalls

### 10.1 Biome error: `useImportType` / `useExportType`

**Problem:** You imported a type without the `type` qualifier.

```typescript
// Causes error
import { Location } from '@doors/api';
```

**Fix:** Add `type` to the import.

```typescript
import type { Location } from '@doors/api';
```

Or use mixed import syntax when combining values and types:

```typescript
import { api, type Location, type Person } from '@doors/api';
```

**Auto-fix:** `bun run check` fixes these automatically.

### 10.2 Biome error: `useExplicitReturnType`

**Problem:** An exported function lacks a return type annotation.

```typescript
// Causes error
export function fetchPeople() {
  return api.people.get();
}
```

**Fix:** Add the return type.

```typescript
export function fetchPeople(): Promise<Person[]> {
  return api.people.get();
}
```

### 10.3 Biome error: `noExplicitAny`

**Problem:** You used `any` as a type.

```typescript
// Causes error
function parseJson(input: string): any {
```

**Fix:** Use `unknown` and narrow with type guards.

```typescript
function parseJson(input: string): unknown {
  return JSON.parse(input);
}
```

### 10.4 TypeScript error: `noUncheckedIndexedAccess`

**Problem:** Accessing a record/object by key without checking for `undefined`.

```typescript
const lookup: Record<string, Person> = {};
const person = lookup[id];       // TypeScript error: person is Person | undefined
const name = person.displayName; // TypeScript error: person might be undefined
```

**Fix:** Narrow or use optional chaining.

```typescript
const person = lookup[id];
if (person) {
  const name = person.displayName; // OK
}

// Or
const name = lookup[id]?.displayName; // OK
```

### 10.5 TypeScript error: `verbatimModuleSyntax`

**Problem:** You imported a type without `type`.

```typescript
import { Location } from './types'; // Error if Location is a type
```

**Fix:**

```typescript
import type { Location } from './types';
```

### 10.6 `@ts-ignore` is banned

Biome's `noTsIgnore` rule errors on `@ts-ignore`. Use `@ts-expect-error` instead with an explanation comment.

```typescript
// Correct
// @ts-expect-error - Third-party library type is wrong, tracked in issue #123
const result = someLib.doThing();

// Wrong — Biome will error
// @ts-ignore
const result = someLib.doThing();
```

Note that Biome does not require the explanation text — that is a project convention, not a lint rule.

### 10.7 Non-null assertion generates a warning

```typescript
const name = person.name!; // Warning: use optional chaining or narrowing instead
```

Warnings do not fail CI, but they are signals that the code could be safer. Prefer narrowing:

```typescript
const name = person.name ?? 'Unknown';
```

### 10.8 Import boundary violations

**Mobile importing server:**

```typescript
import { app } from '@doors/server'; // Error in apps/mobile/**
```

**Fix:** Import from `@doors/api` instead.

**Backend importing mobile:**

```typescript
import { MapView } from 'apps/mobile/src/components/MapView'; // Error in packages/api/** and apps/server/**
```

**Fix:** Extract shared types into `packages/api` and import from there.

---

## 11. Best practices

### 11.1 Run checks early, run checks often

Run `bun run check` and `bun run typecheck` frequently during development — after writing each logical block, before staging, and definitely before pushing. Fixing one error is cheaper than fixing ten.

### 11.2 Let Biome format for you

Configure your editor to format on save with Biome. The project's `biome.json` is the single source of truth — there is no Prettier config or `.editorconfig` to worry about.

If you use VS Code, install the [Biome extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) and add to your settings:

```json
{
  "editor.formatOnSave": true,
  "[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "[javascript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[json]": { "editor.defaultFormatter": "biomejs.biome" }
}
```

### 11.3 Write types first, then implementation

Start with the type definitions (interfaces, function signatures) before writing the implementation. This surfaces type errors early and makes the code self-documenting.

### 11.4 Use `unknown` instead of `any`

When interacting with dynamic data (API responses, `JSON.parse`, user input), type the boundary as `unknown` and narrow with type guards or Zod schemas. This forces you to validate the shape at runtime.

### 11.5 Keep functions focused

Small functions with one responsibility are easier to type correctly and easier to document. If a function needs many inline step comments, consider splitting it.

### 11.6 Prefer nullish coalescing over non-null assertion

```typescript
// Prefer this
const timeout = config.timeout ?? 5000;

// Avoid this (warning)
const timeout = config.timeout!;
```

### 11.7 Handle API failures gracefully

The frontend must never crash when the API is unreachable. Use React Query's `onError` callbacks or fallback states to show empty data or cached data instead of crashing.

```typescript
export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: () => api.v1.locations.get(),
    // Degrade gracefully on network failure
    retry: 1,
    staleTime: 30_000,
  });
}
```

### 11.8 Commit with `bun run ci` green

Before pushing, ensure `bun run ci` and `bun run typecheck` both pass with zero diagnostics. If they don't, the CI pipeline will reject the branch.

### 11.9 Keep overrides minimal

Biome overrides exist for pragmatic reasons (config files, shadcn components, etc.). If you are tempted to add a new override, consider whether the file can be refactored to conform to the standard rules instead. Each override reduces the consistency that Biome provides.

---

## Appendix: Quick reference

### Commands

```bash
bun run check          # Auto-fix formatting + lint (safe)
bun run check:unsafe   # Auto-fix including unsafe fixes
bun run ci             # Read-only check (matches CI)
bun run typecheck      # TypeScript type-checking
```

### File locations

| File | Purpose |
|------|---------|
| `biome.json` | Biome configuration (format, lint, overrides) |
| `tsconfig.base.json` | Shared TypeScript strict settings |
| `apps/*/tsconfig.json` | Workspace-specific TypeScript configs (extend base) |
| `AGENTS.md` | Agent instructions including docstring and quality rules |

### Quality gates

1. Zero Biome diagnostics (`bun run ci`)
2. Zero TypeScript errors (`bun run typecheck`)
3. JSDoc on all exported declarations (project convention, not tool-enforced)
4. Inline step comments inside functions (project convention, not tool-enforced)
5. Frontend must degrade gracefully on API failure (architecture requirement)
