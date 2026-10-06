# Features & decisions — Rayfin Demo

Human-readable `idea → decisions → features` read-through of the ADR ledger (`docs/ADR/`). Future plans on top, history below. Updated in lockstep with `.log/daily/`.

## ⭐ North Star (DRAFT — not locked by USER, proposed 2026-10-06)
1. Ship the seeded todo app to a dev Fabric workspace with Entra SSO sign-in working end-to-end.
2. Replace the Todo placeholder with one demo domain entity plus one connector to existing Fabric data (semantic model via DAX, or warehouse).
3. CI deploy via GitHub Actions with a service principal.

## Open decision forks (USER)
| # | Fork | Options | Default if silent |
|---|------|---------|-------------------|
| ~~F1~~ | Target workspace | **RESOLVED 2026-10-06: `EMBEDDING PROD` is the test workspace (F64 capacity)** | — |
| F2 | North Star | lock · amend · retire | stays DRAFT |
| F3 | `supabase` / `vercel` MCP entries | keep · remove | keep (unused) |
| F4 | vitest 3 → 5 (2 critical dev-only advisories) | now · later | later (dev-only) |
| F5 | `CLAUDE-template.md` in repo | delete · keep | keep |
| F6 | fin agent doc paths vs CLAUDE.md paths | patch agent · patch CLAUDE.md | CLAUDE.md wins at runtime |
| F7 | Branch model | `main` only · `dev`/`prod` ← `feat/*` | `main` only for demo |
| F8 | Second subagent for front-end lane | add · skills-only | skills-only |
| F9 | Patch `.claude/skills/fabric-apps-rayfin/references/*` for 1.36.2 drift (findById, neq, role names, deploy-id files, in-package docs, connector preflight) | patch now · leave, rely on CLAUDE.md note | patch next session |
| ~~F10~~ | `user_id` max | **MOOT: Todo removed; `Person` has `max` on every text field** | — |
| F11 | Names register visibility | owner-only (current) · shared across all signed-in users (drop the `policy`) | owner-only |

## Ideas (parking lot → see `docs/ADD/ideas/ideas.md`)
- IDEA-001 Reuse `dataapp` template patterns for an analytics screen once a connector exists.
- IDEA-002 Semantic-model DAX connector feeding a Power BI-style widget (owner is a Power BI practitioner).

## Decisions
| ID | Date | Decision | ADR | Status |
|----|------|----------|-----|--------|
| D-001 | 2026-10-06 | Seed from `todoapp` template (auth + CRUD + per-user RLS; no external item ids needed) | ADR-0001 | proposed |
| D-002 | 2026-10-06 | `@vitejs/plugin-react` (Babel) instead of `plugin-react-swc` — Application Control blocks SWC native binary | ADR-0002 | proposed |
| D-003 | 2026-10-06 | `rayfin` MCP (version-locked docs) added to `.mcp.json`; fin also has microsoft-learn | — | applied |
| D-004 | 2026-10-06 | `.log/` is tracked; `.env.local`, `.env.fabric*`, `rayfin/.env*` ignored | — | applied |
| D-005 | 2026-10-06 | Test workspace = `EMBEDDING PROD` (e7e263e3-1103-4fbb-9098-2ad78bf30664), F64 capacity; dry run verified; USER has full access | — | locked by USER |
| D-007 | 2026-10-06 | `Person` entity owner-only; Todo entity/service/test removed before first deploy (non-destructive) | fin DEC-004 | applied |
| D-006 | 2026-10-06 | Sequence: dev loop → first deploy → GitHub CI/CD (service principal) → data-containing app (connector) | — | locked by USER |

## Features
| ID | Feature | State | Notes |
|----|---------|-------|-------|
| FT-001 | Todo CRUD (template placeholder) | removed 2026-10-06 | superseded by FT-004 before any deploy |
| FT-002 | Fabric SSO sign-in (`RayfinAuthService`) + local mock (`MockAuthService`) | implemented (template) | SSO only verifiable once deployed |
| FT-003 | First deploy to dev workspace | planned | blocked on F1 + `rayfin login` |
| FT-004 | Names register: `Person` entity (owner-only), save / search / rename / delete / table | implemented 2026-10-06 | not yet deployed; shared-list visibility = fork F11 |
| FT-005 | Connector to existing Fabric data (semantic model / warehouse) | planned | needs workspace + item id via `connector search` |
| FT-006 | GitHub Actions deploy (service principal) | planned | needs Entra app reg + tenant setting + repo secrets |
