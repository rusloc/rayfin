# Rayfin Demo — AI Coding Instructions

> This file is for AI coding assistants working on the Rayfin Demo codebase.
> It contains pointers, user communication rules, logging routine, critical rules, and conventions (product spec lives in `docs/`).

## Project identity

- **Project name**: Rayfin Demo (`rayfin-demo` in `rayfin/rayfin.yml`)
- **One-line purpose**: First demo Microsoft Fabric App — a React web app whose backend (SQL database, GraphQL API, auth) is generated and hosted by Fabric Apps (codename Rayfin), with Microsoft Entra ID sign-in via Fabric SSO.
- **Canonical domain / workspace**: Fabric workspace **`EMBEDDING PROD`** (id `e7e263e3-1103-4fbb-9098-2ad78bf30664`) — despite the name this is the **test workspace** for this app (locked by USER 2026-10-06). It sits on an **F64 capacity**, so no trial or capacity assignment is needed. Tenant: `iss-gf.com` (`18825f30-3cd6-485f-a5d9-c17b6c740212`). No production workspace exists yet.
- **Public surface/URL**: the Fabric item hosting URL printed by `npx rayfin up` (none yet — nothing deployed).
- **Runtime hook**: `VITE_FABRIC_WORKSPACE_ID` / `VITE_FABRIC_ITEM_ID` / `VITE_RAYFIN_API_URL` / `VITE_RAYFIN_PUBLISHABLE_KEY` are the canonical source of truth at runtime. Chain (CLI 1.36): `rayfin up` / `rayfin dev` write the deployment registry `rayfin/.deployments.json` and merge `RAYFIN_PUBLIC_*` into `rayfin/.env` → `rayfin env --framework vite` (runs as `prebuild`) emits `.env.local`. All three files are gitignored. `rayfin.yml` does NOT hold the ids (fin verified against CLI 1.36.2; the older `.env.fabric-*` / ids-in-yml story in our skill is stale). Do NOT hard-code the workspace or item id in code. Names above are for docs/copy/UX-text only.

---

## Quick navigation

| What | Where |
|------|-------|
| Global project overview & summary | `docs/rayfin-demo-ai-coding-brief.md` |
| Product overview | `docs/product/overview.md` |
| Application Design documents (ADD) | `docs/ADD/` |
| Architecture Decision Records (ADRs) | `docs/ADR/` |
| Feature specs | `docs/ADD/features/` |
| Tech stack + rationale | `docs/ADD/tech-stack.md` |
| Anti-patterns catalogue (codified bug-class memory) | `docs/ADD/anti-patterns.md` |
| Features plan, log of implementation, user idea stash | `.log/features_and_decisions.md` |
| Raw ideas / parking lot | `docs/ADD/ideas/ideas.md` |
| Rayfin platform rules (our skill) | `.claude/skills/fabric-apps-rayfin/SKILL.md` + `references/` |
| Rayfin official skills (scaffolder-shipped, version-locked) | `.agents/skills/rayfin*/SKILL.md` — read, don't edit |
| Fin's persistent memory | `.claude/agent-memory/fabric-app-builder/MEMORY.md` |
| Rayfin in-package docs (highest-trust source) | `node_modules/@microsoft/rayfin-*/assets/docs/` via the `rayfin` MCP or `npx rayfin docs search <q>`; read `rayfin-guide/assets/docs/known-limitations.md` before any entity design |

Path note: the fin agent prompt references `docs/architecture/decisions/`, `docs/architecture/anti-patterns.md` and `docs/features/`. **This file's paths win** (`docs/ADR/`, `docs/ADD/anti-patterns.md`, `docs/ADD/features/`). Flagged for the user to align the agent prompt.

---

## Orchestration map

Main agent (Claude Fable 5.1) routes work to sub-agents and skills. Auto-route obvious cases. Ask the user only when the request spans two lanes or routing is genuinely ambiguous. Main agent does not write Rayfin platform code — it routes, sequences, verifies. Prioritize sub-agent utilization.

### Sub-agents

| Agent | Owns | Auto-route triggers | Defers to | Short name |
|-------|------|---------------------|-----------|------------|
| `fabric-app-builder` | `rayfin/**`, `rayfin.yml`, entities, `@role`, `schema.ts`, `src/services/rayfinClient.ts`, auth services, connectors, `rayfin up` / `db apply` / `dev`, GitHub Actions deploy | "entity", "permission", "who can see", "connector", "semantic model", "DAX", "deploy", "rayfin up", "sign-in", "SSO", any file under `rayfin/` | `web-app-architect` skill for stack / topology / "should this be a Fabric App"; front-end skill for UI | **fin** |
| _(main agent + skills)_ | `src/components/**`, `src/pages/**`, `src/hooks/**`, styling, charts, tests | "component", "page", "layout", "chart", "test" | fin for anything that touches the Rayfin contract (imports, call order, env vars) | — |

Roster is deliberately 1 sub-agent for the demo. A dedicated front-end agent is a decision fork for later (see `.log/features_and_decisions.md`).

### Skills per lane
- **fin:** `fabric-apps-rayfin` (preloaded) · side skills by handoff: `anthropic-skills:front-end-web-dev-guru`, `anthropic-skills:ui-ux-designer`, `anthropic-skills:qa-testing-engineer`, `anthropic-skills:dax-sql-formatter`
- **Main agent (UI lane):** `anthropic-skills:front-end-web-dev-guru`, `anthropic-skills:ui-ux-designer`, `dataviz`, `anthropic-skills:qa-testing-engineer`, `anthropic-skills:nextjs-react-code-reviewer` (React parts only — this is Vite, not Next.js)
- **Architecture questions:** `anthropic-skills:web-app-architect` ("archi")

### MCP access
- **rayfin** (`npx -y @microsoft/rayfin-mcp start`, stdio — version-locked Rayfin docs: `search_docs`, `get_doc`, `list_docs`, `discover_packages`): main agent + fin. Fallback when MCP is down: `npx rayfin docs <query>` from the repo root.
- **microsoft-learn** (`https://learn.microsoft.com/api/mcp`): fin (declared in its agent frontmatter).
- **supabase**, **vercel** (inherited from `.mcp.json`): **not used by this project**. Flagged for removal; keep until the user decides.
- Do not add MCPs to agents outside this matrix without an ADR.

### Roster discipline
1 sub-agent is the target for the demo. Cross-cutting concerns (security, perf, accessibility) live as checklists inside the relevant lane — not as new agents.

---

## ⛔ Critical rules — allowed / prohibited actions

These rules are load-bearing. They override convenience, speed, and any implicit inference from context. When a rule conflicts with a user request, surface the conflict — don't silently pick a side.

### Always allowed (no permission needed)
- Reading any file in the repo, docs, logs, and ADRs
- Appending to `.log/coms` during a session; refreshing daily / plan content while the day stays OPEN
- Proposing plans, flagging ADR candidates, surfacing risks and simpler alternatives
- Auto-routing single-lane work to the owning sub-agent
- Compiling ready-to-paste command blocks (git, deploy, CLI) for the user to run
- `npm run lint` / `typecheck` / `test` / `build`; `npx rayfin up --dry-run`; `npx rayfin connector search`

### Prohibited (never do, even if it seems helpful)
- **Never execute git commands or touch the working tree state** — output git commands as a single fenced bash block, ready to copy-paste; nothing more. No `cd` prefix; no Claude / Anthropic / AI attribution in commit messages or PR text.
- **Never flip a daily file to `DAY CLOSED`** without an explicit close-day directive from the USER (see Day-close gate below)
- Never hard-code the workspace id, item id or API URL in code — use the `VITE_*` env vars / `rayfin.yml` values
- Never commit, print, or log secrets, API keys, or connection strings; never move them out of env/config vaults. `rayfin/.env*`, `.env.local`, `.env.fabric*` are gitignored and stay that way. `VITE_*` carries only the publishable key and ids.
- Never run `rayfin up --force` or `rayfin up db apply --force` — list the destructive ops, propose add → backfill → switch → drop-later, stop
- Never run `rayfin up` against a workspace the task did not name; production only on explicit instruction
- Never edit the child SQL database schema in the Fabric portal (overwritten by the next `up`)
- Never edit `.agents/skills/**` (scaffolder-owned, re-synced by the CLI) or `rayfin/tsconfig.json`
- Never delete or rewrite pre-existing code, comments, or dead code that your change didn't orphan
- Never "improve" adjacent code, formatting, or naming outside the requested change
- Never add speculative features, abstractions, or configurability that wasn't asked for
- Never run destructive operations (drops, deletes, resets, force-push, data purges) — propose the command, let the USER run it
- Never mark a task done without running its verification check
- Never invent file paths, table names, workspace / item ids, or API shapes — verify against the repo, `metadata.json`, `rayfin/.deployments.json`, `npx rayfin env --show` or `connector search` first

### Ask first (stop and confirm before acting)
- Any architectural choice → write/propose an ADR before implementing
- Cross-lane or ambiguous routing
- Schema/data-model changes beyond the explicitly requested scope (schema is expensive to change once data exists)
- Introducing a new dependency, service, connector, or MCP
- Anything touching auth, `@role` policies, permissions, or user data handling
- First `rayfin up` into any workspace (it creates a Fabric item)
- When multiple interpretations of a request exist — present them, don't pick silently
- When day-close intent is ambiguous → ask: "Close the day, or keep it open?"

---

## User communication rules

### ⭐ Active North Star — standing directive

> **DRAFT — not yet locked by USER (proposed 2026-10-06).** Lock, amend or retire in the next session.
>
> **(1)** Ship the seeded todo app to a dev Fabric workspace with Entra SSO sign-in working end-to-end. **(2)** Names-register entity (`Person`, done 2026-10-06) plus one connector to existing Fabric data (semantic model via DAX, or warehouse). **(3)** CI deploy via GitHub Actions with a service principal.
>
> **Carry rule:** surface these goals at session start, and reproduce the North Star block near the top of EVERY next-day `.log/plan/*` draft and EVERY `.log/daily/*` summary. Retire the directive when USER says the goals are met (or explicitly asks to retire it).

### At session start
- Check current date against file names and make sure to use the current date to plan and do the work
- Read last `.log/coms` file, last `.log/daily` summary, current day's + one previous + one future plan in `.log/plan` (i.e. prev day plan + current day plan + tomorrow day plan)
- If any of `.log/coms`, `.log/daily`, `.log/plan` is missing or malformed (wrong date format, missing required headings, empty file) → notify user, ask what to do
- Read `rayfin/rayfin.yml`, `rayfin/data/schema.ts` and `npm ls @microsoft/rayfin-core @microsoft/rayfin-cli --depth=0` — the app's ground truth
- Known drift in our skill vs installed 1.36.2 typings (fin, 2026-10-06; patch pending — fork F9): client has `findById`, not `findByPk`; filter op is `neq`, not `ne` (plus `startsWith`, `endsWith`, `isNull`, `in`); `@role` first arg is only `authenticated | anonymous` (shorthands `@authenticated()` / `@anonymous()`); `@text()` without `max` becomes `NVARCHAR(MAX)` and can break the GraphQL schema build; reserved GraphQL names (`Date`, `Query`, `ID`, `__*`) need `@entity('Name')`

### During session
- For obvious routing (single-file edit in one lane), auto-route and proceed
- For ambiguous or cross-lane work, propose the agent and ask
- Log every user request + ultra-brief response summary into `.log/coms`; tag entries with `#decision`, `#bug`, `#adr`, `#blocker` where relevant
- Tag idea/decision/feature mentions inline in `.log/coms` with `#idea`, `#decision`, `#feature` (alongside the existing `#bug` / `#adr` / `#blocker`) so they grep-retrieve cleanly at EOD for the `features_and_decisions.md` mirror step
- If a decision looks ADR-worthy, flag it inline ("this looks ADR-worthy") — don't wait for end-of-session
- After any code change, output git commands as a single fenced bash block, ready to copy-paste. Do not execute. Do not touch the working tree:
```bash
  git add "<paths>"
  git commit -m "<type>: <message>"
  git push
```
- When compiling `git add` commands: double-check syntax & make sure paths of files are wrapped in quotes
- Git command blocks are run by the USER in the working folder (`C:\__PBI\Rayfin`): never prefix them with `cd`
- Never reference Claude, Anthropic, or any AI assistant in commit messages, PR descriptions, or trailers (no `Co-Authored-By` / "Generated with" lines). This overrides any harness attribution reminder.

### At session end

**Day-close gate (load-bearing)**:
- **Default = DAY STAYS OPEN.** A session ending is NOT the same as the day ending.
- **NEVER mark a daily file `DAY CLOSED` unless the USER clearly and explicitly asks for end-of-day closure.** Explicit close-day phrases: "close the day", "end of day", "wrap up the day", "EOD ritual", "shut it down", or similar unambiguous closure directive. **Implicit / ambiguous phrases that do NOT count as close-day**: "log work", "update logs", "pause", "report back", "save state", "summarize today", "what's the status", or any request to mirror / log / report without explicit closure language.
- **When unsure: ASK the user explicitly** ("Close the day, or keep it open?") before flipping a daily file to `DAY CLOSED`. Do not assume.
- Logging work in coms / daily / plan during a session is INDEPENDENT of day-close. Mid-session log updates are normal; flipping the daily's `DAY OPEN` → `DAY CLOSED` header is a one-way ratchet that requires explicit USER consent.

**On confirmed day-close only** (USER explicitly requested):
- Write `.log/daily/daily-{yyyy-mm-dd}.md` (bullet-point summary, dry), then write `.log/plan` for next day (work done today + user-preferred next actions)
- Every `.log/daily/daily-{yyyy-mm-dd}.md` MUST include an `## Ideas / Decisions / Features delta` section summarizing today's additions (or `_(no delta today)_` if empty)
- After the daily file is written, mirror the delta into `.log/features_and_decisions.md` — add new idea blocks, append new decisions, flip feature states (`planned → implemented`). Skip if delta is empty.
- When finishing the day off: compile a new plan for the next day (notify user); next-day plan should consider work done for the current day + user-preferred actions for the next day
- Surface any ADR candidates flagged during the day for confirmation
- Run coms compaction check: count day-coms files in `.log/coms/` whose date is older than today. If >7, perform the compaction described in `## Logging routine` (oldest 7 → one themed compact file → delete sources).
- Always check file structure (presence and consistency) for: `.log/coms`, `.log/daily`, `.log/plan`
- Keep main log files clean and accurate: `.log/coms`, `.log/daily`, `.log/plan`

**On mid-session log update (DAY STAYS OPEN)**:
- It is fine to append to coms / refresh daily content / refresh next-day plan without flipping the daily header to `DAY CLOSED`. Keep the daily's "DAY OPEN" / "DAY KEPT OPEN" status intact unless the USER explicitly closes the day.

---

## Logging routine

- Daily coms: `.log/coms/coms-{yyyy-mm-dd}.md` — every user request + brief response
- Daily summary: `.log/daily/daily-{yyyy-mm-dd}.md` — bullet-point implementations, dry
- Weekly summary: `.log/weekly/weekly-{yyyy-Www}.md` — bullet-point implementations, comment section for describing issues, findings, ideas captured during the week; this file extends the semantic picture of a past week with more details via plain text
- Tag conventions in coms files: `#decision`, `#bug`, `#adr`, `#blocker` (for grep retrieval)
- Weekly rollup: last working day of the week, append a 5-line summary to `.log/weekly/weekly-{yyyy-Www}.md` linking back to daily files
- Coms compaction (evening housekeeping): if `.log/coms/` holds more than 7 day-coms files older than today, compact the oldest 7 into a single file named `coms-compact {first-date}_{last-date} — {theme-slug}.md`. For each request inside: one-sentence user essence + one-sentence AI response summary, as a bullet under a `## {yyyy-mm-dd}` heading. Theme slug summarizes the dominant work of the window (e.g. `scaffold-to-first-deploy`). Preserve `#decision` / `#bug` / `#adr` / `#blocker` tags inline — they are grep anchors. After the compact file is written and verified, hard-delete the 7 source day-coms files — full detail still lives in `.log/daily/`. Compact files are not counted as "old day-coms" for the next pass.
- File-structure consistency check (run at session start): correct date format, file-per-day, required headings present
- Features & decisions tree: `.log/features_and_decisions.md` — human-readable `idea → decisions → features` read-through of the ADR ledger (`docs/ADR/`). Holds future plans on top of historical record. Updated daily in lockstep with `.log/daily/`.
- Anti-patterns catalogue: `docs/ADD/anti-patterns.md` — codified recurring failure shapes. Candidates surface in daily summaries with `CAND-NNN` IDs; promote to the catalogue on second sighting (or single high-cost hit by judgment). Consult before reviewing code that touches a known anti-pattern's surface. Fin keeps its own Rayfin-specific list in `.claude/agent-memory/fabric-app-builder/domain/`.
- When writing / composing future plans (files), always clearly state that the file is a draft in projection state at the very start of the file contents

---

## Universal conventions

### Naming (all tracks)
- Files: `kebab-case.ts` for modules; `PascalCase.tsx` for React components; entities `PascalCase.ts` under `rayfin/data/` (the class name is the table / API name)
- Env vars / parameters: `SCREAMING_SNAKE_CASE`; public/client-safe values explicitly prefixed `VITE_` (Rayfin emits them from `RAYFIN_PUBLIC_*`)
- DB tables: generated from entity class names by Rayfin — do not name tables by hand; owner column is `user_id` (text, from `claims.sub`); FK columns are always `{property}_id`
- Branches: `{type}/{short-description}` (`feat/`, `fix/`, `chore/`)

### Branching & CI

- `main` → deploys to the test workspace `EMBEDDING PROD` via `rayfin up` (GitHub Actions, service principal — workflow drafted 2026-10-06, secrets not yet set) ← `feat/*`
- Whether a separate `dev` / `prod` branch-to-workspace mapping is wanted is a **decision fork** for the user (demo may not need it)
- CI: lint → typecheck → build → test → `rayfin up --workspace <ws> --yes` (never `--force` on push; `--force` only via manual dispatch checkbox)

### Testing policy
- **All manual / smoke / click-test runs happen on the deploy target** (the Fabric item in the dev workspace) — not against localhost — unless a heavy need for local testing arises. Reason: Fabric SSO only works when deployed; local dev uses the email/password mock path, which is not production behaviour.
- Automated tests (Vitest + Testing Library) still run locally and in CI as usual; the rule above applies to **manual end-to-end / interactive verification only**.
- Gauntlet before any push touching `rayfin/`: `npm run lint && npm run typecheck && npm run build && npm test && npx rayfin up --dry-run`

### Languages / locales supported
`en` only — UI + content locked together at MVP.

---

## Track-specific conventions

### ▶ TRACK A — Web app on a Fabric Apps (Rayfin) backend

**Stack:** React 19 · Vite 7 · TypeScript strict · Tailwind 4 · react-router 7 · Vitest · `@microsoft/rayfin-*` 1.36.x (core = entity decorators, client = typed GraphQL client, auth-provider-fabric = Entra SSO, cli = dev/deploy, local-dev = Vite adapter) · backend = Fabric App item (SQL database + GraphQL API + auth + static hosting) in a Fabric workspace

**Structure:**
```
rayfin/
  rayfin.yml          → backend config: auth (fabric SSO + local password), data (mssql), staticHosting
  data/*.ts           → entities (@entity + @role) — single source of truth for DB schema, API and permissions
  data/schema.ts      → mandatory registry; key = client accessor (client.data.Person)
  connectors/         → CLI-generated connectors to existing Fabric items (none yet)
  .env (gitignored)   → values for ${VAR} interpolation + ids written by `rayfin up`
src/
  services/           → ONLY place that talks to Rayfin: rayfinClient.ts (singleton), bootstrap.ts (env → client → auth service),
                        IAuthService / MockAuthService (local) / RayfinAuthService (Fabric SSO), people.ts (Person CRUD + search wrappers)
  hooks/AuthContext   → session state mirrored into React
  components/, pages/ → UI only; no Rayfin imports
  __tests__/          → Vitest
.agents/skills/       → official Rayfin skills shipped by the scaffolder (read-only)
.claude/              → our agent (fin), skill, agent memory
docs/, .log/          → design docs, ADRs, work logs
```

**Key rules (Rayfin platform — see `.claude/skills/fabric-apps-rayfin/SKILL.md` for the full list):**
- Every entity carries a `@role`; new entities start owner-only (`claims.sub.eq(item.user_id)`) and widen only on an explicit requirement. `anonymous` or unfiltered `'*'` needs a stated reason.
- Every entity is registered in `rayfin/data/schema.ts`; nullable = `{ optional: true }` in the decorator (a TS `?` alone stays NOT NULL); PK is always `id: string` UUID; no many-to-many, no composite keys, no `@one()` to `USER`
- Relative imports inside `rayfin/` use `.js` extensions (emitted ESM)
- `initEmbeddedAuth()` on page load; `ensureSignedInWithFabric()` only inside a synchronous click handler (popup). Never after an `await`.
- `services.auth.enabled` and `services.auth.fabric.enabled` stay `true` (deploy fails otherwise). Password sign-in is local-only.
- `rayfin dev` defaults to `--provider fabric`: it provisions a real backend into a Fabric workspace. Docker is not installed on this machine, so `--provider docker` is unavailable. First run needs `-w <workspace>`.
- After `rayfin connector add`, run the exact `npm install` line it prints (versions must match the CLI)
- Client-side checks are UX, never enforcement. No business logic in components — `src/services/` is the single boundary.
- Select only needed fields, paginate growing lists, pull relations via dot-paths; there is no `count()`.
- **Build toolchain:** `@vitejs/plugin-react` (Babel) replaces the template's `plugin-react-swc` because Windows Application Control blocks SWC's native binary on this machine. Do not switch back; do not add deps that need native `.node` bindings without checking they load.
- DAX (connectors) and SQL (child DB read queries) follow the house style skill `anthropic-skills:dax-sql-formatter` — applied silently and always.

**Database conventions:**
- **Tenancy:** single-tenant per Fabric item; row ownership via `@text() user_id` filled from `claims.sub`. Users live in the item's Users table (provisioned on first SSO sign-in).
- **IDs:** `@uuid() id` on every entity (server-generated when omitted). Never expose sequential ids.
- **Money:** `@decimal()`; never float.
- **Soft-delete:** not used in the demo. If a feature needs history, add `@date({ optional: true }) deletedAt` and filter in `@role` policies — ADR first.
- **Schema changes:** `npx rayfin up db apply` (non-destructive). Anything the CLI lists as destructive is reported and waits for the user.

**Deployment:**
- test workspace `EMBEDDING PROD` (F64) ← `main`. No prod workspace yet. Always pass `-w "EMBEDDING PROD"` (or rely on the `rayfin/.deployments.json` registry once the first `up` has run); never fall back to "My Workspace".
- Deploy via `npx rayfin up` (full) or `npx rayfin up db apply` / `npx rayfin up staticapp deploy` (targeted). Manual portal edits are prohibited.
- Post-deploy checks: `npx rayfin up status`, open the hosting URL, sign in with Fabric, save / search / rename / delete a name as two different users and confirm each sees only their own rows.

---

## Before you code

1. Read the relevant feature spec in `docs/ADD/features/`
2. Check `docs/ADD/tech-stack.md` and `docs/rayfin-demo-ai-coding-brief.md` for where the change fits
3. Check `docs/ADR/` for any ADRs that constrain your approach
4. If making an architectural choice, write a new ADR before implementing

### Core coding rules

#### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

#### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

#### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

#### 4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
