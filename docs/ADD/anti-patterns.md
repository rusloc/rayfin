# Anti-patterns catalogue — Rayfin Demo

Codified recurring failure shapes. Candidates (`CAND-NNN`) surface in `.log/daily/`; promote here on second sighting or a single high-cost hit. Fin keeps Rayfin-platform quirks separately in `.claude/agent-memory/fabric-app-builder/domain/`.

| ID | Shape | Why it bites | Do instead | Seen |
|----|-------|--------------|------------|------|
| AP-001 | Adding a dependency that ships a native `.node` binding without checking it loads | Windows Application Control on the dev machine blocks unsigned native modules (`@swc/core` 2026-10-06) → build and tests die with `ERR_DLOPEN_FAILED` | Prefer pure-JS deps; if native is unavoidable, `node -e "require('<pkg>')"` before adopting | 1 (promoted: high cost, whole toolchain down) |
| AP-002 | Entity shipped without `@role` or with unfiltered `'*'` | API is public to every signed-in user; client checks are not enforcement | Owner-only policy via `claims.sub.eq(item.user_id)` first; widen by explicit requirement | 0 (pre-registered from skill non-negotiables) |
| AP-003 | TS `?` used to mean nullable column | Column stays NOT NULL; inserts fail at runtime | `{ optional: true }` in the decorator | 0 (pre-registered) |
| AP-004 | `ensureSignedInWithFabric()` called on load or after an `await` | Popup blocked; sign-in silently fails | Call only inside the synchronous click handler; `initEmbeddedAuth()` on load | 0 (pre-registered) |
| AP-005 | `*.log`-style gitignore globs that also match a bare directory name | `.log/` work logs silently never reach the repo | Re-include with `!.log/` + `!.log/**` right after the glob | 1 |

## Candidates
- CAND-001 → promoted to AP-001 (2026-10-06).
