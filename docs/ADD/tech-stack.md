# Tech stack + rationale

| Layer | Choice | Version (2026-10-06) | Why |
|-------|--------|----------------------|-----|
| Backend platform | Microsoft Fabric Apps (Rayfin) | `@microsoft/rayfin-*` 1.36.2 | The point of the demo: entities → SQL DB + GraphQL + auth + hosting as one Fabric item; no server code to write or host |
| Entity decorators | `@microsoft/rayfin-core` | 1.36.2 | Single source of truth for schema + `@role` permissions |
| Typed client | `@microsoft/rayfin-client` | 1.36.2 | `RayfinClient<Schema>` query builder; identity attached automatically |
| Auth | `@microsoft/rayfin-auth-provider-fabric` | 1.36.2 | Entra ID via Fabric SSO (popup / embedded), PKCE + nonce handled by SDK |
| CLI | `@microsoft/rayfin-cli` (dev dep) | 1.36.2 | `rayfin dev`, `up`, `up db apply`, `up staticapp deploy`, `connector`, `docs` |
| Local dev adapter | `@microsoft/rayfin-local-dev` | 1.36.2 | Vite plugin + env emission; provider `fabric` (Docker not installed) |
| Frontend | React 19 + react-router 7 | 19.x / 7.x | Template default; SPA served from the item's static hosting |
| Bundler | Vite 7 | 7.3.x | Template default |
| React transform | `@vitejs/plugin-react` (Babel) | ^5.2 | **Deviation from template** (`plugin-react-swc`): Windows Application Control blocks SWC's native `.node` binary on the dev machine. v6 needs Vite 8 + oxc native → stay on 5.x. ADR-0002 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) | 4.1.x | Template default |
| Tests | Vitest 3 + Testing Library + jsdom | 3.2.x | Template default. 2 critical advisories (tinypool, @vitest/mocker) are dev-only; fix = vitest 5 major (fork F4) |
| Lint | ESLint 9 flat config + typescript-eslint | 9.x | Template default |
| Language | TypeScript strict, ESM (`"type": "module"`) | 5.8.x | `rayfin/` emits ESM → `.js` import suffixes required |
| Docs / MCP | `@microsoft/rayfin-mcp` (stdio) + Microsoft Learn MCP | 1.36.2 | Version-locked docs beat the drifting web pages |
| Fabric tooling on machine | `fab` CLI 1.7.0, `az` CLI | — | Workspace listing / portal ops; **separate login from `rayfin login`** |

Not in the stack (and why): Docker (not installed; Rayfin's `fabric` provider replaces it), Next.js (Rayfin ships a static SPA; SSR has no host), Supabase / Vercel (MCPs inherited in `.mcp.json`, unused here).
