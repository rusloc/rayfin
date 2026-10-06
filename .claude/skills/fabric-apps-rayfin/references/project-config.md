# Project layout & config

## Layout
```text
project/
├── rayfin/
│   ├── data/           # entities (*.ts) + schema.ts
│   ├── connectors/     # one folder per connector (CLI-generated)
│   ├── .env            # values for ${VAR} interpolation (gitignored)
│   ├── .temp/          # generated backend artifacts (gitignored)
│   ├── rayfin.yml      # backend config
│   └── tsconfig.json   # CLI project reference; don't edit
├── src/                # frontend (template: React or Vue)
├── package.json
└── tsconfig.json
```
Local backend serving stale schema/config → stop and restart the dev stack to regenerate `.temp/`.

## rayfin.yml
```yaml
id: my-app            # required; slug = Fabric item id + compose project name
name: my-app          # required; display name
version: 1.0.0        # required; semver
services:             # required
  auth:
    enabled: true                         # mandatory for deploy
    expiryInMinutes: 60                   # JWT lifetime
    refreshToken: { lifetimeInDays: 30 }
    customClaims: { tenant: default }     # in session + usable in @role policies
    scopes: [read:data, write:data]
    allowedRedirectUris: [http://localhost:5173]   # `up` adds deployed origin
    fabric:   { enabled: true }           # Entra SSO; mandatory when deployed
    password: { enabled: true }           # local dev only
  data:
    enabled: true
    dialect: mssql
  storage:
    enabled: false
  staticHosting:
    enabled: true
    root: .                   # frontend root, relative to project
    folder: dist              # build output, relative to root
    buildCommand: npm run build
    indexDocument: index.html
connectors: []                # managed by `rayfin connector add` (connectors.md)
```
- Any string accepts `${VAR}` / `${VAR:-default}`, resolved from `rayfin/.env` then shell.
- First deploy writes `rayfinItemId`, `fabricWorkspaceId` and item endpoint into this file; keep them so redeploys target the same item.
- `auth.passwordless` (magic link, SMS OTP) and `auth.email` (SMTP) exist for local dev; leave disabled unless asked.
- After edits: restart local backend, or `npx rayfin up` for deployed.

## Frontend env (Vite)
| Var | Value |
|---|---|
| `VITE_RAYFIN_API_URL` | Backend base URL (local default `http://localhost:5168`) |
| `VITE_RAYFIN_PUBLISHABLE_KEY` | Publishable key |
| `VITE_FABRIC_ITEM_ID` | Written by `rayfin up` to `.env.fabric-<workspace>` and `.env.fabric` |
| `VITE_FABRIC_WORKSPACE_ID` | Same as above |
| `VITE_FABRIC_PORTAL_URL` | Portal base, e.g. `https://app.fabric.microsoft.com` (set manually) |

## .gitignore minimum
```text
rayfin/.env
rayfin/.temp/
```

Source: https://learn.microsoft.com/en-us/fabric/apps/project-structure
