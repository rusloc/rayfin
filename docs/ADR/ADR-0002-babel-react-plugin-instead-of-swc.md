# ADR-0002 — Use `@vitejs/plugin-react` (Babel) instead of the template's `plugin-react-swc`

- **Status:** proposed (2026-10-06) — awaiting USER acceptance (already applied so the build works)
- **Deciders:** USER (owner), main agent (proposer)

## Context
The `todoapp` template wires `@vitejs/plugin-react-swc` into `vite.config.ts` and `vitest.config.ts`. On the dev machine (Windows 11 Home 10.0.26200) `vite build` and `vitest` fail with:

```
Error: An Application Control policy has blocked this file.
...\node_modules\@swc\core-win32-x64-msvc\swc.win32-x64-msvc.node
code: 'ERR_DLOPEN_FAILED'
```

Reproduced from both the Temp scratchpad and `C:\__PBI\Rayfin` → machine-wide policy, not path-scoped. Other native bindings in the toolchain load fine (`esbuild` 0.28.1, `@rollup/rollup-win32-x64-msvc`).

## Decision
Replace `@vitejs/plugin-react-swc` with `@vitejs/plugin-react@^5` (Babel-based, pure JS) in both Vite configs. Pin to the 5.x line: 6.x requires Vite 8 and `oxc-transform-react`, another native transformer.

## Consequences
- Build, 2 tests, lint and typecheck pass.
- Slightly slower dev transforms than SWC; irrelevant at demo size.
- Rule added to `CLAUDE.md` and anti-pattern AP-001: check native bindings before adopting a dependency.
- If the Application Control policy is relaxed or the machine changes, SWC can be restored by reverting this ADR; nothing else depends on it.

## Alternatives rejected
- Allow-listing the SWC binary in Application Control: needs admin policy change; brittle across machines/CI.
- Vite 8 + plugin-react 6: pulls oxc native binding, likely blocked the same way, and diverges from the Rayfin template's Vite 7 line.
