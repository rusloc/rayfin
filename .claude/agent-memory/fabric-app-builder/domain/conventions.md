# Conventions (CNV) and antipatterns (ANTI) — inductive

Repo norms (`kind: norm`) and the local refuse-list (`kind: refuse`), folded together while short. Promotion bar: two sightings; singles live in `candidates.md`.
Freshness buckets by `Last-verified`: fresh <90d · verified 90–270d · aging >270d.

<!-- next-id: CNV-002 -->
<!-- next-id: ANTI-001 -->

### CNV-001 · Service modules keep an `isLocalBackend()` in-memory branch as the Vitest seam · 2026-10-06
**Kind:** norm
**What:** Every `src/services/<entity>.ts` data wrapper mirrors the template shape: `if (isLocalBackend()) { ...in-memory array... }` first, then the `getRayfinClient()` path. Tests mock `@/services/rayfinClient` (`isLocalBackend: () => true`) and exercise the service contract without a backend. The branch is not a local-dev feature (CAND-002: `rayfin dev` is fabric-only here); it is the agreed test seam, kept minimal.
**Why / Evidence:** Template `todos.ts` (sighting 1); USER-directed `people.ts` on 2026-10-06 kept the same pattern explicitly "so the Vitest test can run without a backend" (sighting 2).
**Where:** `src/services/people.ts`, `src/__tests__/people.test.ts` (former `todos.ts` / `todos.test.ts`)
**Hits:** 2 · **Confidence:** medium · **Tags:** services, testing, local-dev
**Last-verified:** 2026-10-06 · **Related:** CAND-002, DEC-004
**Status:** active
