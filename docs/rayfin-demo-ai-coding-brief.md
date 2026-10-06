# Rayfin Demo — AI coding brief

## What this is
A first demo Microsoft Fabric App. The frontend is a React + Vite single-page app. The backend is **not written by us**: Fabric Apps (codename Rayfin) compiles the TypeScript entities in `rayfin/data/` into a SQL database, a GraphQL API and permission policies, hosts them as a single Fabric item inside a workspace, and serves the built frontend from the same item. Sign-in is Microsoft Entra ID through Fabric SSO.

## Mental model of the flow
```
                 rayfin/data/*.ts  (@entity, @role, fields)
                        │  npx rayfin up  /  rayfin up db apply
                        ▼
   ┌──────────── Fabric App item (one per rayfin.yml id, in one workspace) ────────────┐
   │  child SQL database  ◄──  GraphQL API (DAB)  ◄──  auth service (Entra / Fabric SSO) │
   │  static hosting  (dist/ from `npm run build:fabric`)                              │
   └───────────────────────────────────────────────────────────────────────────────────┘
                        ▲                                   ▲
      RayfinClient<Schema>.data.Todo.select/create/…        ensureSignedInWithFabric()
                        │                                   │  (popup → Entra → postMessage → session)
                src/services/*  ◄── bootstrap.ts reads VITE_* env ──  .env.local  ◄── rayfin env ◄── rayfin/.env + .deployments.json ◄── rayfin up
```
1. **Model first.** An entity class is the only schema definition. `@role('authenticated', '*', { policy: (c, i) => c.sub.eq(i.user_id) })` is compiled into a row filter enforced by the API on every call. Client code cannot bypass it.
2. **One client.** `src/services/rayfinClient.ts` creates the single typed `RayfinClient<TodoAppSchema>`; `bootstrap.ts` picks `MockAuthService` (localhost API URL, email/password) or `RayfinAuthService` (deployed, Fabric SSO) and returns it to React through `AuthContext`.
3. **Auth.** On load, `initEmbeddedAuth()` recovers a session if the app runs inside the Fabric portal iframe. Otherwise the "Sign in with Fabric" button calls `ensureSignedInWithFabric()` inside the click handler (popup needs a user gesture). First sign-in provisions the user in the item's Users table.
4. **Data.** `client.data.Todo.select([...]).orderBy(...).execute()` → GraphQL → SQL, already filtered by the signed-in user. Writes set `user_id` from `session.user.id`.
5. **Deploy.** `npx rayfin up -w <workspace>`: create/reuse item → sync `rayfin.yml` → apply schema (refuses destructive ops without `--force`) → build + zip + upload `dist/` → write ids into `rayfin/.deployments.json` and `RAYFIN_PUBLIC_*` in `rayfin/.env` (then `rayfin env` emits `.env.local`). `rayfin dev` does the same provisioning (provider `fabric`) and then runs Vite locally against that backend.

## Where things live
See `CLAUDE.md` → Track A structure. Platform rules: `.claude/skills/fabric-apps-rayfin/`. Official version-locked docs: `rayfin` MCP or `npx rayfin docs`.

## Current state (2026-10-06)
Seeded from the `todoapp` template, builds and tests green, nothing deployed, workspace not chosen, Rayfin CLI not logged in. See `.log/features_and_decisions.md` for forks.
