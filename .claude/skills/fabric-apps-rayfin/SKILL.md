---
name: fabric-apps-rayfin
description: Build, configure, secure and deploy Microsoft Fabric Apps (codename Rayfin), the SDK/CLI platform where TypeScript-decorated entities become a Fabric SQL database, GraphQL API and typed client. Use whenever a task touches a Fabric App or Rayfin project - rayfin.yml, rayfin/data entities (@entity, @role, @one, @many), schema.ts, RayfinClient or ConnectorsRayfinClient calls, connectors to a Fabric lakehouse, warehouse, SQL database or semantic model (DAX), Fabric SSO / Entra sign-in (ensureSignedInWithFabric, initEmbeddedAuth), npx rayfin up / db apply / staticapp deploy, or GitHub Actions CI/CD with a service principal. Trigger on any @microsoft/rayfin-* package, a rayfin/ folder, or phrases like "Fabric app", "Rayfin app", "deploy to Fabric", "Fabric data app", even if the SDK is not named. Covers platform rules only; generic TypeScript/JavaScript, React/Vue, UI and styling work belong to the separate web and front-end skills.
---

# Fabric Apps (Rayfin)

Pipeline: decorated TS classes in `rayfin/data/` → CLI compiles SQL schema + permission policies + GraphQL → `RayfinClient` consumes them → `npx rayfin up` ships backend, schema and static frontend to a Fabric workspace.

## Scope
- **In:** project layout, `rayfin.yml`, entities and permissions, data-client calls, connectors, auth wiring, CLI deploy, CI.
- **Out:** TS/JS language matters, framework/UI code (hooks, components, routing, styling), bundler config. Delegate to the TS/JS, web-dev and front-end skills, handing them the Rayfin contract (imports, call order, env vars) from the references below.

## Route by task
| Task | Read |
|---|---|
| Scaffold, layout, `rayfin.yml`, env vars, `.gitignore` | `references/project-config.md` |
| Entities, field types, relations, `schema.ts`, `@role` permissions | `references/data-model.md` |
| App reads/writes data (CRUD, filter, sort, paginate) | `references/data-client.md` |
| Lakehouse / warehouse / SQL DB / semantic model access | `references/connectors.md` (+ `data-model.md` for `@role`) |
| Sign-in, sessions, Fabric SSO, embedded mode | `references/auth.md` |
| `rayfin up`, schema apply, static redeploy, GitHub Actions | `references/deploy.md` |

Load only what the task needs. Typical feature = data-model → data-client → deploy.

## Workflow
1. New project: `npm create @microsoft/rayfin@latest`; existing repo: `npx rayfin init`.
2. Define/modify entities in `rayfin/data/*.ts`, attach `@role`, register in `rayfin/data/schema.ts`.
3. Wire the frontend through one shared `RayfinClient` (`ConnectorsRayfinClient` when connectors exist).
4. `npm run dev` to test frontend changes against the backend.
5. Ship: `npx rayfin up` (full) or targeted `npx rayfin up db apply` / `npx rayfin up staticapp deploy`.

## Non-negotiables
Most broken Fabric Apps violate one of these; check every change against them.
- Deploy requires `services.auth.enabled: true` and `services.auth.fabric.enabled: true`; `rayfin up` fails otherwise. Email/password works only locally; SSO works only when deployed.
- Every entity is registered in `rayfin/data/schema.ts`; unregistered entities get no client proxy and their relations vanish from the API.
- Nullable column = `{ optional: true }` in the decorator. A TS `?` alone keeps the column NOT NULL.
- PK is always `id: string` (UUID). No composite/custom keys, no many-to-many (use a join entity), no `@one()` to system `USER` (store `user_id` from `claims.sub`).
- Relative imports inside `rayfin/` use `.js` extensions (emitted ESM).
- Every reachable entity carries a `@role`. Client-side types are not an authorization boundary.
- `ensureSignedInWithFabric()` runs only inside a synchronous user-gesture handler; `initEmbeddedAuth()` is the page-load call.
- `--force` (on `up` or `db apply`) drops data. Use it only when the task explicitly approves the listed destructive ops; otherwise stop and report them.
- Never commit `rayfin/.env` or `rayfin/.temp/`; commit `rayfin/.env.example`.
- After `rayfin connector add`, run the exact `npm install` line it prints (versions must match the CLI).

## Doc conflicts (resolved)
Microsoft's pages disagree; use:
- `@boolean()`, not `@bool()`.
- `client.data.<SchemaKey>.select(...)` where `<SchemaKey>` is the key in `schema.ts`, not `client.data.products.query()`.
- `@role` row filter option is `policy`, not `check`.

If installed package typings or `npx rayfin --help` contradict this skill, follow the installed version and flag the mismatch.

## Report back
Finish with: files created/changed; CLI commands run and outcome; commands still required from the user (login, `db apply`, `up`); destructive schema ops awaiting approval; work delegated to other skills.
