# Data client (`RayfinClient`)

One shared instance per app. The instance that signs in attaches identity to every data call; never pass tokens manually. Sign in first when entities require `authenticated` (see `auth.md`).

```ts
import { RayfinClient } from '@microsoft/rayfin-client';
import type { AppSchema } from '../rayfin/data/schema.js';

export const client = new RayfinClient<AppSchema>({
  baseUrl: import.meta.env.VITE_RAYFIN_API_URL ?? 'http://localhost:5168',
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
});
```

## Read
```ts
const notes = await client.data.Note
  .select(['id', 'title', 'notebook.name'])     // dot-path pulls related fields in one query
  .where({ isPinned: { eq: true } })
  .orderBy({ isPinned: 'desc' })
  .orderBy({ createdAt: 'desc' })              // chain for multi-column sort
  .execute();                                  // → Note[]

const one = await client.data.Note.findByPk(id); // → Note | null
```
Filter ops: `eq` `ne` `gt` `gte` `lt` `lte` `contains`.

## Paginate (cursor)
```ts
const page = await client.data.Note
  .select(['id', 'title', 'createdAt'])
  .orderBy({ createdAt: 'desc' })
  .first(25)
  .executePaginated();          // { items, hasNextPage, endCursor }
// next page: same chain + .after(page.endCursor) before .executePaginated()
```

## Write
```ts
await client.data.Note.create({ title, user_id: session.user.id, notebook: { id: nbId } });
// returns created row incl. generated id; relation via { id } or the full fetched object

await client.data.Note.update({ id }, { title, notebook: { id: otherNbId } }); // (filter, patch)

await client.data.Note.delete({ id }); // resolves even when nothing matched
```

## Limits & practice
- No `count()`. `PagedResult.totalCount` is never populated; use `items.length`.
- Select only needed fields; paginate any list that can grow; fetch relations via dot-paths, not extra calls.
- Cache static reference data client-side.

Source: https://learn.microsoft.com/en-us/fabric/apps/read-write-data-graphql
