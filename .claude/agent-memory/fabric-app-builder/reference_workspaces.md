---
name: fabric-workspaces
description: Fabric tenant and the locked test workspace "EMBEDDING PROD" for rayfin-demo; fab CLI vs rayfin login are separate sign-ins; CI needs an SP with Contributor there
metadata:
  type: reference
---

Fabric tenant `18825f30-3cd6-485f-a5d9-c17b6c740212` (`iss-gf.com`). Deploy (test) workspace: **`EMBEDDING PROD`** — see update below; the candidate list is historical.

Candidates seen via `fab ls` on 2026-10-06: `CUSTOM DEV`, `DEV`, `APP`, `NEW_APP_CI_CD_FLOW_TEST`, `TEST`.

- `fab` (Fabric CLI) login is separate from `rayfin login`; one being signed in says nothing about the other. The Rayfin CLI was not signed in as of 2026-10-06.
- Pass the workspace explicitly on the first `rayfin up` / `rayfin dev` (`-w <name>` or `--workspace-id <guid>`, `-t <tenant>` if the account spans tenants); `rayfin up` defaults to "My Workspace" when omitted.
- Deploy ids land in `rayfin/.deployments.json` and `rayfin/.env` (both gitignored), not in `rayfin.yml`; `rayfin up list` / `rayfin up switch` manage multiple workspaces.
- No secrets here; publishable key and ids come from `rayfin/.env` → `.env.local` via `rayfin env --framework vite`.


**Update 2026-10-06 (main agent, from USER):** test workspace = `EMBEDDING PROD` (id e7e263e3-1103-4fbb-9098-2ad78bf30664), F64 capacity — the name says PROD but it is the test target for this app. `rayfin login` done by USER; `rayfin up --dry-run -w "EMBEDDING PROD"` succeeded.
