# Fabric App Builder (fin) — Memory Index

## Collaboration
- [Reference: tenant iss-gf.com; test ws = "EMBEDDING PROD" (locked 2026-10-06, F64); fab login ≠ rayfin login](reference_workspaces.md)

## Domain
<!-- <file> — N entries · class or buckets · hot: top IDs by score -->
- [decisions.md](domain/decisions.md) — 3 · durable · hot: DEC-001, DEC-003 (CI workflow shape), DEC-002
- [quirks.md](domain/quirks.md) — 3 · core/cli 1.36.2 · hot: QRK-001 (findById), QRK-003 (no custom roles), QRK-002 (neq)
- [conventions.md](domain/conventions.md) — 0 · 0/0/0
- [candidates.md](domain/candidates.md) — 2 awaiting second hit (CAND-001 `@text` max, CAND-002 dead local fallbacks)

## Open questions
- 2026-10-06: Skill patch pending for QRK-001..003, stale deploy-id claims (ids go to `rayfin/.deployments.json` + `rayfin/.env`, not `rayfin.yml` / `.env.fabric-*`; CLAUDE.md line 12 already corrected), and `references/deploy.md` CI sample (global install → `npx`, keychain flag, tenant setting name "Service principals can call Fabric public APIs"). See DEC-003.
- 2026-10-06: Does `--encryption-fallback-enabled` turn out to be required on ubuntu-latest? Confirm on the first CI run; refine DEC-003 either way.
- 2026-10-06: Does a local `rayfin up -w "EMBEDDING PROD"` adopt the CI-created item by name and record it in the registry? Unverified inference in `docs/ADD/features/ci-cd-service-principal.md` §5.6.
