# ADR-0001 — Seed the demo from the Rayfin `todoapp` template

- **Status:** proposed (2026-10-06) — awaiting USER acceptance
- **Deciders:** USER (owner), main agent (proposer)

## Context
First session. The demo must show a web app on a Fabric backend with Entra login. `npx @microsoft/create-rayfin@1.36.2 --list-templates` offers `blankapp` (capability router, interactive), `dataapp` (analytics over existing Fabric data; needs workspace + item ids up front), `gettingstartedauth` (todo + Tailwind + docs), `todoapp` (todo CRUD + Fabric auth + per-user row-level security).

## Decision
Scaffold in place from `todoapp` with `--services auth,data --auth-methods fabric --dialect mssql`, project id `rayfin-demo`. Keep the scaffolder-shipped `.agents/skills/*` and `AGENTS.md` (version-locked official guidance) next to our `.claude/` setup.

## Rationale
- Exercises the full data path (entity → `@role` → client → UI → Fabric SSO) with zero external item ids, so it can be seeded and built before any workspace decision.
- `dataapp` would have blocked on `connector search` ids and a chosen workspace; its patterns can be borrowed later (IDEA-001).
- Smallest surface to replace: one entity (`Todo`), one service (`todos.ts`), one page.

## Consequences
- The Todo entity is a placeholder; the demo domain entity is a planned feature (FT-004).
- `.mcp.json` from the template was merged by hand into the existing one (added `rayfin` stdio server).
- Template README is replaced by the scaffold's README (previous README was empty).

## Alternatives rejected
- `dataapp`: blocked on ids; heavier. — `blankapp`: interactive router, not reproducible non-interactively. — Hand-rolled `rayfin init` in the existing repo: more steps, same result.
