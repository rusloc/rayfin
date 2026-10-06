# Candidates (CAND) — single sightings awaiting a second hit

Default `Expires:` is 90 days after the sighting. On a second sighting: allocate a CNV/ANTI id in `conventions.md`, set `Hits: 2`, mark the candidate `Promoted-to`.

<!-- next-id: CAND-003 -->

### CAND-001 · `@text()` without `max` on a stored column · 2026-10-06
**Kind:** refuse (ANTI candidate)
**What:** `rayfin/data/Todo.ts:19` declares `@text() user_id!: string` with no `max`. On MSSQL that compiles to `NVARCHAR(MAX)`; the guide's `known-limitations.md` (rayfin-guide 1.36.2) warns the metadata provider may fail to build the GraphQL schema from such columns, surfacing as "Internal server error" after an otherwise clean deploy.
**Proposed rule:** every `@text()` on `rayfin/data/*` carries `max` (`claims.sub` ids fit in 128; free text gets an explicit cap).
**Evidence:** `node_modules/@microsoft/rayfin-guide/assets/docs/known-limitations.md` ("Database and Schema Apply"), template as shipped.
**Hits:** 1 · **Confidence:** low · **Tags:** data-model, mssql, text
**Applied:** `rayfin/data/Person.ts` (2026-10-06) — every `@text()` carries `max`; the bare `@text()` left the repo with `Todo.ts`. Still 1 sighting of the failure shape; promote only if a bare `@text()` reappears or a deploy reproduces the error.
**Expires:** 2027-01-04

### CAND-002 · Localhost/in-memory fallbacks are dead code under `--provider fabric` · 2026-10-06
**Kind:** refuse (ANTI candidate)
**What:** `src/services/todos.ts` (in-memory branch) and `src/services/MockAuthService.ts` run only when `VITE_RAYFIN_API_URL` is localhost, i.e. `rayfin dev --provider docker`. Docker is not installed on this machine and `rayfin dev` defaults to `fabric` (`npx rayfin dev --help`, cli 1.36.2), so these paths never execute outside Vitest. Adding more "local fallback" branches would grow untested code.
**Proposed rule:** new `src/services/*` functions call the Rayfin client unconditionally; keep test doubles in `src/__tests__/`, not in production branches.
**Evidence:** `src/services/bootstrap.ts:8-15,26`, `src/__tests__/todos.test.ts:3-6` (mocks `isLocalBackend` to reach the branch), CLAUDE.md testing policy (manual checks on the deploy target).
**Hits:** 2 · **Confidence:** medium · **Tags:** services, local-dev, dead-code
**Resolution:** second sighting (`people.ts`, 2026-10-06) was a deliberate USER choice to keep the branch as the Vitest seam → recorded as the norm **CNV-001**, not as a refuse entry. **Promoted-to:** CNV-001 on 2026-10-06
