# Product overview — Rayfin Demo

## Purpose
Prove, end to end, that a line-of-business web app can be built and shipped inside a Microsoft Fabric workspace with no separate backend: Entra sign-in, per-user data, typed API, static hosting — all from one `rayfin up`.

## Audience
Internal: the Power BI / Fabric team evaluating Fabric Apps as a way to put small transactional UIs next to analytical data.

## MVP scope (seeded)
- Sign in with Fabric (Entra ID). First sign-in provisions the user.
- Personal todo list: create, toggle complete, delete. Each user sees only their own rows (row-level `@role` policy).
- Works locally against a provisioned Fabric backend (`rayfin dev`) and deployed as a Fabric item.

## Next scope (planned, see `.log/features_and_decisions.md`)
- One demo domain entity replacing Todo.
- One connector to existing Fabric data (semantic model via DAX or warehouse table) surfaced in the UI.
- CI deploy from GitHub.

## Out of scope
Multi-tenant SaaS, public/anonymous access, mobile, SSR, billing.
