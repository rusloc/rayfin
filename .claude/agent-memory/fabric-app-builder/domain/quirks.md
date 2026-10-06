# Quirks (QRK) — version-bound

Platform behavior that differs from docs or from `.claude/skills/fabric-apps-rayfin`. Each entry is true *for a version*; re-score after every Rayfin bump (`npm ls @microsoft/rayfin-core @microsoft/rayfin-cli --depth=0`).
Evidence comes from installed typings or in-package docs (`node_modules/@microsoft/<pkg>/assets/docs/`, the `rayfinDocs` convention), which outrank Microsoft Learn.

<!-- next-id: QRK-004 -->

### QRK-001 · Single-record fetch is `findById`, not `findByPk` · 2026-10-06
**What:** `client.data.<Entity>.findById(id)` exists; `findByPk` does not. Our skill's `references/data-client.md` shows `findByPk`.
**Why / Evidence:** `node_modules/@microsoft/rayfin-data/dist/graphql/GraphQLEntityClient.d.ts:169-186` — doc comment reads "Use this instead of `findByPk` (which does not exist on this client)"; signature `findById(id: string): Promise<TSchema[TEntity] | null>`. Guide `rayfin-guide/assets/docs/data/graphql.md:138` uses `findById`. Template `src/services/todos.ts:72` uses `findById` and typechecks.
**Where:** `src/services/todos.ts:72`; skill `references/data-client.md` (Read section)
**Versions:** rayfin-core 1.36.2 · rayfin-cli 1.36.2 · rayfin-data 1.36.2
**Hits:** 1 · **Confidence:** high · **Tags:** data-client, api-name, skill-gap
**Last-verified:** 2026-10-06 · **Related:** QRK-002
**Status:** active — skill patch proposed (rename in data-client.md)

### QRK-002 · Filter operator is `neq`, not `ne`; more operators than the skill lists · 2026-10-06
**What:** `where()` string/number filters accept `eq neq gt gte lt lte contains startsWith endsWith isNull in`; boolean/date filters have their own subsets. Our skill lists `eq ne gt gte lt lte contains`.
**Why / Evidence:** `node_modules/@microsoft/rayfin-data/dist/graphql/types.d.ts:50-93` (`neq?: string`, `startsWith?`, `endsWith?`, `isNull?: boolean`, `in?: string[]`). No `ne` member anywhere in the package typings.
**Where:** skill `references/data-client.md` ("Filter ops" line)
**Versions:** rayfin-core 1.36.2 · rayfin-data 1.36.2
**Hits:** 1 · **Confidence:** high · **Tags:** data-client, filter, skill-gap
**Last-verified:** 2026-10-06 · **Related:** QRK-001
**Status:** active — skill patch proposed

### QRK-003 · `@role` accepts only `'authenticated' | 'anonymous'`; no custom role names · 2026-10-06
**What:** The first argument of `role()` is typed as the literal union `'authenticated' | 'anonymous'`. Our skill's `references/data-model.md` says "or custom names". Shorthands `@authenticated(actions?, options?)` and `@anonymous(actions?, options?)` exist and the guide's known-limitations says to prefer them.
**Why / Evidence:** `node_modules/@microsoft/rayfin-core/dist/decorators/decorators.d.ts:70` (`roleName: 'authenticated' | 'anonymous'`), `:94` and `:117` (shorthands). Guide `rayfin-guide/assets/docs/data/permissions.md:27` ("`'anonymous'` or `'authenticated'`"). `claims.role` still exists in `ClaimsDsl` (`policy.d.ts:181-188`) for policy expressions; role-based rules go through `policy`, not through a custom role name.
**Where:** skill `references/data-model.md` (Permissions → Roles)
**Versions:** rayfin-core 1.36.2
**Hits:** 1 · **Confidence:** high · **Tags:** permissions, role, skill-gap
**Last-verified:** 2026-10-06
**Status:** active — skill patch proposed

## Verified, no quirk (skill already right on 1.36.2)
- `@boolean()` is the export; no `bool` anywhere in `rayfin-core/dist/**/*.d.ts` (`index.d.ts:1`, `decorators.d.ts:421`).
- `@role` row filter option is `policy` (`options.d.ts:93-106` `RoleDeclarationOptions.policy`). `check` exists only in the compiled storage-config `CheckNode`, never as a decorator option.
- `ConnectorsRayfinClient` is exported from the top-level `@microsoft/rayfin-client` (`dist/index.d.ts:7`), even though it lives under `dist/experimental/`.
- `totalCount?` is declared on `PagedResult` but the guide confirms DAB never populates it (`data/graphql.md:239`); no `count()`.
