# Deploy & CI

Prerequisites: an Entra account with workspace access; at least **Edit** permission on the app item; `services.auth.enabled` and `services.auth.fabric.enabled` both `true`.

## Commands
| Command | Effect |
|---|---|
| `npx rayfin login` | Interactive sign-in (`up` prompts automatically). Rerun on 401/403. |
| `npx rayfin up` | Full deploy (sequence below). |
| `npx rayfin up --dry-run` | Show the plan without changing anything. |
| `npx rayfin up db apply [--force]` | Schema only. |
| `npx rayfin up staticapp deploy [--skip-build]` | Frontend only: build, zip, upload. |
| `npx rayfin up status [--json]` | Deployment state. |
| `rayfin up --workspace <name> --yes [--force]` | Non-interactive (CI). `--yes` accepts non-destructive prompts. |

`up` sequence: create or reuse the item → fetch publishable key → sync `rayfin.yml` settings → apply schema → build, zip and upload static content (if `staticHosting.enabled`) → persist ids to `rayfin.yml` and `.env.fabric-*`. It prints the hosting URL, portal link and deployment ID. Later runs update the same item.

## Rules
- Destructive schema ops (drop column, rename table) are refused. `--force` only after the listed ops are reviewed and approved.
- Static zip limit is 100 MB. Exclude source maps and large assets, or move binaries to Fabric Apps storage.
- Portal: the child SQL Database runs read queries; schema edits made there are overwritten by the next `up`. Signed-in users live in its Users table.

## GitHub Actions (service principal)
Setup:
1. Entra app registration with a client secret.
2. Service principal gets Contributor or higher on the target workspace.
3. Fabric admin enables the tenant setting that lets service principals use Fabric APIs.
4. Workspace must already exist; the workflow doesn't create it.
5. Repo secrets: `CLIENT_ID`, `TENANT_ID`, `CLIENT_SECRET`, `FABRIC_WORKSPACE_NAME`.

`.github/workflows/deploy-to-fabric.yml`. Differences from the Microsoft docs sample: the login step there lacks `\` continuations and `$` on the secret (fixed), and `npm ci` is added because the build and entity compile need dependencies.
```yaml
name: Deploy to Fabric

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      force:
        description: 'Allow destructive schema changes that may result in data loss'
        required: false
        default: false
        type: boolean

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      CLIENT_ID: ${{ secrets.CLIENT_ID }}
      TENANT_ID: ${{ secrets.TENANT_ID }}
      CLIENT_SECRET: ${{ secrets.CLIENT_SECRET }}
      FABRIC_WORKSPACE_NAME: ${{ secrets.FABRIC_WORKSPACE_NAME }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm install -g @microsoft/rayfin-cli
      - name: Login (service principal)
        run: |
          rayfin login --service-principal \
            -t "$TENANT_ID" \
            -u "$CLIENT_ID" \
            -p "$CLIENT_SECRET"
      - name: Deploy
        run: |
          EXTRA_ARGS=""
          if [[ "${{ inputs.force }}" == "true" ]]; then EXTRA_ARGS="--force"; fi
          rayfin up --workspace "$FABRIC_WORKSPACE_NAME" --yes $EXTRA_ARGS
```
- `--force` is reachable only through the manual-dispatch checkbox; pushes deploy non-destructively.
- Concurrency is per branch. To give each environment its own workspace, vary `FABRIC_WORKSPACE_NAME` per branch or GitHub environment.
- If connectors are used, pin the global CLI to the project's Rayfin version (`@microsoft/rayfin-cli@<version>`).

Sources:
- https://learn.microsoft.com/en-us/fabric/apps/deploy-app
- https://learn.microsoft.com/en-us/fabric/apps/deploy-github-actions
