# Entities & permissions

All decorators import from `@microsoft/rayfin-core`.

## Entity
```ts
// rayfin/data/Note.ts
import { entity, role, uuid, text, boolean, date, one } from '@microsoft/rayfin-core';
import { Notebook } from './Notebook.js';

@entity()
@role('authenticated', '*', { policy: (claims, item) => claims.sub.eq(item.user_id) })
export class Note {
  @uuid() id!: string;                        // PK; auto-added and server-generated if omitted
  @text({ max: 200 }) title!: string;
  @text({ optional: true }) content?: string; // nullable column
  @boolean({ default: false }) isPinned!: boolean;
  @date() createdAt!: Date;
  @text() user_id!: string;                   // owner, filled from claims.sub
  @text() notebook_id!: string;               // FK; declare only if code reads/sets it
  @one(() => Notebook) notebook?: Notebook;
}
```

## Field decorators
| Decorator | TS type | SQL |
|---|---|---|
| `@uuid()` | `string` | UNIQUEIDENTIFIER |
| `@text()` | `string` | NVARCHAR |
| `@email()` | `string` | NVARCHAR + email validation |
| `@int()` | `number` | INT |
| `@decimal()` | `number` | DECIMAL |
| `@boolean()` | `boolean` | BIT |
| `@date()` | `Date` | DATETIME2 (accepts ISO string or `Date`) |
| `@set('a','b')` | `'a' \| 'b'` | enumerated strings |

Options (combinable): `optional: true` (nullable; default is required) · `unique: true` · `default: value` · `min` / `max` (string length or numeric range) · `column: 'SourceName'` (connector entities only).

## Relationships
- Child: `@one(() => Parent) parent?: Parent;` → FK `parent_id` is created automatically.
- Parent: `@many(() => Child) children?: Child[];`
- FK name is always `{property}_id`; `foreignKey` / `targetKey` options unsupported.
- Many-to-many: explicit join entity holding two `@one()`.
- No `@one()` to system entities (`USER`): use `@text() user_id` populated from `claims.sub`.
- Relation missing from API → check the navigation decorator exists and both entities are in `schema.ts`.

## schema.ts (mandatory registry)
```ts
// rayfin/data/schema.ts
import type { Note } from './Note.js';
import type { Notebook } from './Notebook.js';

export type AppSchema = { Note: Note; Notebook: Notebook };
```
Key = client accessor (`client.data.Note`). Add every new entity.

## Permissions: `@role(roleName, actions, options?)`
- **Roles:** `authenticated` (valid session), `anonymous` (no session; read https://learn.microsoft.com/en-us/fabric/apps/anonymous-data-access before using), or custom names.
- **Actions:** `'create' | 'read' | 'update' | 'delete' | '*'`, single or array.
- **Options:** `policy: (claims, item) => expr` (row filter) · `include: [...]` / `exclude: [...]` (field-level; typed to entity props, so renames break at compile time).
- **Claims:** `claims.sub` (user id), `claims.email`, `claims.role`, plus `customClaims` from `rayfin.yml`.
- **Expressions:** `.eq(value)`; combine with `.and()` / `.or()` (auto-parenthesized).
- Multiple `@role` on one class aggregate per role; conflicting declarations warn.
- Compiled at `db apply` into data-access policies (`@claims.sub eq @item.userId`) and enforced on every API call.

```ts
// owner-only, all actions
@role('authenticated', '*', { policy: (c, i) => c.sub.eq(i.ownerId) })

// admin or owner edits; only admin deletes
@role('authenticated', ['create', 'read', 'update'], {
  policy: (c, i) => c.role.eq('admin').or(c.sub.eq(i.ownerId)),
})
@role('authenticated', 'delete', { policy: (c, _i) => c.role.eq('admin') })

// whitelist writable fields on create; hide fields on read/update
@role('authenticated', 'create', { policy: (c, i) => c.sub.eq(i.createdBy), include: ['title', 'content'] })
@role('authenticated', 'read', { exclude: ['passwordHash'] })
@role('authenticated', 'update', { policy: (c, i) => c.sub.eq(i.createdBy), exclude: ['adminNotes'] })

// owned AND active
@role('authenticated', 'read', { policy: (c, i) => c.sub.eq(i.userId).and(i.isActive.eq(true)) })
```

## Apply
`npx rayfin up db apply`. Destructive ops (drop column, rename table) are refused without `--force`; see `deploy.md`.

Sources:
- https://learn.microsoft.com/en-us/fabric/apps/data-models
- https://learn.microsoft.com/en-us/fabric/apps/data-permissions
- https://learn.microsoft.com/en-us/fabric/apps/programming-model
