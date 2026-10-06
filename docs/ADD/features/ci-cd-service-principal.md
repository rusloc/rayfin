# CI/CD: GitHub Actions deploy with a service principal

Manual setup checklist for `.github/workflows/deploy-to-fabric.yml`. Run once, by hand, in this order. Verified 2026-10-06 against `@microsoft/rayfin-cli` 1.36.2 and Microsoft Learn (links at the end).

Target: workspace **`EMBEDDING PROD`** (`e7e263e3-1103-4fbb-9098-2ad78bf30664`, F64) in tenant `18825f30-3cd6-485f-a5d9-c17b6c740212`. Despite its name it is the **test** workspace (CLAUDE.md).

## 1. Entra app registration (the service principal)

Azure portal → **Microsoft Entra ID** → **App registrations** → **New registration**.

- Name: e.g. `rayfin-demo-deploy`. Single tenant. No redirect URI.
- Copy from **Overview**:
  - **Application (client) ID** → GitHub secret `CLIENT_ID`
  - **Directory (tenant) ID** → GitHub secret `TENANT_ID` (must be `18825f30-3cd6-485f-a5d9-c17b6c740212`)
- **Certificates & secrets** → **New client secret** → copy the **Value** column (not the Secret ID) immediately; it is shown once → GitHub secret `CLIENT_SECRET`. Note the expiry date; rotate before it.
- No API permissions are needed: workspace access and the tenant setting below do the authorization.

## 2. Workspace role

Fabric portal → workspace **`EMBEDDING PROD`** → **Manage access** → **Add people or groups** → search the app registration by name → role **Contributor** (Member/Admin also work; Viewer does not) → **Add**.

The workflow creates/updates the Fabric App item (`rayfin-demo`, from `rayfin.yml` `id`) inside this workspace. It never creates workspaces.

## 3. Fabric tenant setting (Fabric admin)

Admin portal → **Tenant settings** → section **Developer settings** → **Service principals can call Fabric public APIs** → Enabled.

- Exact name per Microsoft Learn (Developer admin settings, 2026-04-08). Older docs and the deploy article call it "service principals can use Fabric APIs"; same setting.
- Enabled by default for new tenants. If it is scoped to **specific security groups**, add the service principal to one of those groups (Entra → Groups) — membership, not the setting, is what usually blocks a 401/403 on first run.
- Not needed: "Service principals can create workspaces, connections, and deployment pipelines" (the workspace already exists).

## 4. GitHub repository configuration

Repo → **Settings** → **Secrets and variables** → **Actions**.

| Kind | Name | Value |
|---|---|---|
| Secret | `CLIENT_ID` | Application (client) ID from step 1 |
| Secret | `TENANT_ID` | Directory (tenant) ID from step 1 |
| Secret | `CLIENT_SECRET` | Client secret **Value** from step 1 |
| Variable | `FABRIC_WORKSPACE_NAME` | `EMBEDDING PROD` |

The workspace name is a **variable**, not a secret: it is not sensitive, and a secret would be masked as `***` in every line of the `rayfin up` log. The workflow refuses to run when the variable is empty (otherwise `rayfin up` would silently target "My Workspace"). To pin the GUID instead, add a variable `FABRIC_WORKSPACE_ID` and switch the deploy step to `--workspace-id` (commented in the workflow).

## 5. First run and verification

1. Push the workflow to `main` (or **Actions** → **Deploy to Fabric** → **Run workflow**, branch `main`, **force unchecked**).
2. Watch the run: gates (`lint` → `typecheck` → `test`) must be green before the login step executes.
3. **Deploy to Fabric** step log prints the hosting URL, portal link and deployment ID. Copy the hosting URL into CLAUDE.md "Public surface/URL".
4. **Deployment status** step runs `npx rayfin up status` on the runner and must report the item as deployed.
5. Portal: open workspace `EMBEDDING PROD`, confirm an item named `rayfin-demo` exists, open the hosting URL, sign in with Fabric, create / toggle / delete a todo as two users (CLAUDE.md post-deploy checks).
6. On a developer machine, `npx rayfin up status` only knows deployments recorded locally in `rayfin/.deployments.json` / `rayfin/.env` (gitignored). After a CI-only deploy the machine has no record; expected fix is one local `npx rayfin up -w "EMBEDDING PROD"` to adopt the existing item by name and write the registry (first `up` from a machine needs the USER's go-ahead per CLAUDE.md). Verify this adoption behaviour on first use; it is inferred from `rayfin up --help` ("create or reuse the item"), not yet observed.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Login step: `AADSTS7000215` invalid client secret | Secret **ID** pasted instead of secret **Value**, or secret expired |
| Login step: keychain / `libsecret` error | `--encryption-fallback-enabled` missing (the workflow passes it on both `login` and `up`) |
| Deploy step: 401/403 or "workspace not found" | Step 2 role missing, or step 3 setting scoped to a security group the SP is not in; workspace display name typo (names are matched exactly, including the space) |
| Deploy step lists destructive schema ops and stops | Expected on push. Review the ops; add → backfill → switch reads → drop later. Only a **manual run with force** passes `--force` |
| Build fails only in CI | Node mismatch is unlikely (engines allow 20/22/24); check `npm ci` output vs `package-lock.json` |

## Sources

- Microsoft Learn — Deploy a Fabric app with GitHub Actions: https://learn.microsoft.com/en-us/fabric/apps/deploy-github-actions
- Microsoft Learn — Developer admin settings (tenant setting name): https://learn.microsoft.com/en-us/fabric/admin/service-admin-portal-developer
- In-package guide (1.36.2): `node_modules/@microsoft/rayfin-guide/assets/docs/app-backend/deploy.md` (non-interactive login), `cli/index.md` (keychain fallback, `RAYFIN_TELEMETRY_OPTOUT`)
