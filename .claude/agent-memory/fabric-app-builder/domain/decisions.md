# Decisions (DEC) and lessons (LSN)

Durable entries. Lessons are folded in here while the file is short (split past 400 lines).
Binding decisions live in `docs/ADR/`; entries here link, never copy.

<!-- next-id: DEC-004 -->
<!-- next-id: LSN-001 -->

### DEC-001 · Demo seeded from the Rayfin `todoapp` template · 2026-10-06
**What:** Scaffolded in place with `create-rayfin@1.36.2` `todoapp` (`--services auth,data --auth-methods fabric --dialect mssql`, project id `rayfin-demo`); `.agents/skills/*` and `AGENTS.md` kept as scaffolder-owned.
**Why / Evidence:** Full data path (entity → `@role` → client → UI → Fabric SSO) with zero external item ids, so it builds before any workspace is chosen. `dataapp` blocked on `connector search` ids. See `docs/ADR/ADR-0001-seed-from-todoapp-template.md` (status: proposed, awaiting user).
**Where:** `docs/ADR/ADR-0001-seed-from-todoapp-template.md`, `package.json` (`template.name: todoapp`), `rayfin/.lockfile.json`
**Versions:** rayfin-core 1.36.2 · rayfin-cli 1.36.2
**Reversal cost:** medium (Todo entity is a placeholder; replacing it is planned work, not a reversal)
**Hits:** 1 · **Confidence:** high · **Tags:** scaffold, template, adr
**Last-verified:** 2026-10-06 · **Related:** DEC-002
**Status:** active

### DEC-002 · `@vitejs/plugin-react` (Babel) instead of the template's `plugin-react-swc` · 2026-10-06
**What:** Both `vite.config.ts` and `vitest.config.ts` use `@vitejs/plugin-react@^5` (pure JS). Pinned to 5.x; 6.x needs Vite 8 plus `oxc-transform-react` (another native binding).
**Why / Evidence:** Windows Application Control on the dev machine blocks `@swc/core-win32-x64-msvc` (`ERR_DLOPEN_FAILED`, machine-wide). `esbuild` and `@rollup/rollup-win32-x64-msvc` load fine. See `docs/ADR/ADR-0002-babel-react-plugin-instead-of-swc.md` and `docs/ADD/anti-patterns.md` AP-001.
**Where:** `vite.config.ts`, `vitest.config.ts`, `package.json` devDependencies
**Reversal cost:** low (revert the ADR when the policy is relaxed; nothing else depends on it)
**Hits:** 1 · **Confidence:** high · **Tags:** toolchain, vite, native-binding, windows
**Last-verified:** 2026-10-06 · **Related:** DEC-001
**Status:** active

### DEC-003 · CI deploy workflow shape (npx CLI, keychain fallback, workspace as variable, status on runner) · 2026-10-06
**What:** `.github/workflows/deploy-to-fabric.yml` deviates from the Microsoft Learn / skill sample in four places: (1) `npx rayfin` from the lockfile-pinned devDependency, no `npm install -g`; (2) `--encryption-fallback-enabled` on both `login --service-principal` and `up`; (3) `FABRIC_WORKSPACE_NAME` is a repo **variable** (`vars.`) with a fail-fast guard when empty, only `CLIENT_ID`/`TENANT_ID`/`CLIENT_SECRET` are secrets; (4) `npx rayfin up status` runs as the last step on the runner.
**Why / Evidence:** (1) CLI must match `rayfin-core`/`-client` (1.36.2); a global install drifts. (2) Hosted ubuntu runners have no OS keychain; guide `cli/index.md` and `getting-started/index.md` (1.36.2) name Linux-without-keychain as the case for the flag; the runner is ephemeral so the plaintext cache dies with the job. (3) A secret is masked `***` in every `rayfin up` log line; `up` defaults to "My Workspace" when the name is empty (`up --help`), hence the guard. (4) The deployment registry (`rayfin/.deployments.json`, `rayfin/.env`) is gitignored and written only where `up` ran, so a dev machine cannot `up status` a CI-only deployment. Also verified: Learn's tenant setting is named "Service principals can call Fabric public APIs" (Developer settings, 2026-04-08), not "…can use Fabric APIs". Gates lint/typecheck/test pass locally on the template as-is.
**Where:** `.github/workflows/deploy-to-fabric.yml`, `docs/ADD/features/ci-cd-service-principal.md`; skill `references/deploy.md` (GitHub Actions section) still shows global install and `.env.fabric-*` ids. No ADR yet (CI shape is North Star item 3; ADR-0003 candidate).
**Versions:** rayfin-cli 1.36.2
**Reversal cost:** low (workflow-only; no data or schema impact)
**Hits:** 1 · **Confidence:** high (items 1, 3, 4) / medium (item 2: flag necessity inferred from docs, not yet observed on a runner) · **Tags:** ci, github-actions, service-principal, deploy, skill-gap
**Last-verified:** 2026-10-06 · **Related:** DEC-001
**Status:** active — first CI run pending (secrets not yet set)
