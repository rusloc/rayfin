# Connectors (existing Fabric data)

| Fabric item | `--type` | Operations |
|---|---|---|
| Lakehouse SQL analytics endpoint | `fabric-sqlanalytics` | `read` only |
| Warehouse | `fabric-warehouse` | `read` `create` `update` `delete` |
| SQL database in Fabric | `fabric-sqldatabase` | `read` `create` `update` `delete` |
| Semantic model | `fabric-semanticmodel` | `executeQuery` (DAX) |

Grant only the operations the app uses.

## Add
```bash
# find the item id (optional name filter as first arg)
npx rayfin connector search "sales" --workspace-id <ws-id> --type fabric-warehouse --json

npx rayfin connector add --type fabric-warehouse --workspace-id <ws-id> \
  --item-id <item-id> --name inventory --operations read
```
Effects:
- Appends to top-level `connectors:` in `rayfin.yml` with `auth.type: delegated` (requests run as the signed-in user; keep it).
- Creates `rayfin/connectors/<name>/` including `metadata.json`.
- Prints a version-matched `npm install ...`; run it verbatim.
- Discovery is best effort; resolve any discovery warning before writing entities.
- Semantic model entries carry a CLI-generated `version`; keep it.

For multiple operations, check `npx rayfin connector add --help` for the list syntax.

## Entity connector (lakehouse / warehouse / SQL DB)
Model only the tables and columns needed, taken from `metadata.json`. Never guess names, types or keys.
```ts
// rayfin/connectors/inventory/Order.ts
import { entity, int, text, role } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

@role('authenticated', ['read'])
@entity()
export class Order extends Source({ schema: 'dbo', table: 'Order', primaryKey: ['orderId'] }) {
  @int({ column: 'OrderID' }) orderId!: number;  // `column` maps to the source name
  @text() customerEmail!: string;
}
```
- Set `primaryKey` only when the source table has a real key. Keyless entities lose by-key operations.
- `@role`, `policy`, `include` and `exclude` behave as in `data-model.md`.

```ts
// rayfin/connectors/inventory/schema.ts
import type { GraphQLBackedConnector } from '@microsoft/rayfin-connector-fabric-graphql';
import type { ConnectorConfig } from '@microsoft/rayfin-connectors';
import { Order } from './Order.js';

export { Order } from './Order.js';

export const connectorConfig = {
  connector: 'fabric-warehouse',
  operations: ['read'],          // keep in sync with rayfin.yml
  entities: { Order },
} as const satisfies ConnectorConfig;

export type InventorySchema = GraphQLBackedConnector<{ Order: typeof Order }, typeof connectorConfig>;
```
Semantic models have no entities; import `connectorConfig` and the schema type from the CLI-generated `rayfin/connectors/<name>/schema.ts`.

## Client
```ts
// src/lib/connectors.ts
import { ConnectorsRayfinClient } from '@microsoft/rayfin-client';
import { fabricSemanticModel } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { connectorConfig as inventoryConfig, type InventorySchema } from '../../rayfin/connectors/inventory/schema.js';
import { connectorConfig as salesModelConfig, type SalesModelSchema } from '../../rayfin/connectors/salesModel/schema.js';

type Connectors = { inventory: InventorySchema; salesModel: SalesModelSchema };

export const client = new ConnectorsRayfinClient<Record<string, never>, Record<string, never>, Connectors>(
  {
    baseUrl: import.meta.env.VITE_RAYFIN_API_URL,
    publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
    authStorage: true,
    connectors: { inventory: inventoryConfig, salesModel: salesModelConfig },
  },
  { salesModel: fabricSemanticModel() },  // runtime required for each semantic-model connector
);
```
- One name everywhere: `rayfin.yml` connector `name` = `Connectors` key = `connectors` config key = `client.connectors.<name>`.
- The first two generics are `Record<string, never>` in this connectors-only setup. If the app also has `rayfin/data` entities, read the package typings to find which slot takes `AppSchema`.
- Creating the client does not sign in; keep the app's sign-in flow (`auth.md`) and query after it.

## Query
```ts
const orders = await client.connectors.inventory.Order
  .select(['orderId', 'customerEmail'])
  .first(20)
  .execute();

const r = await client.connectors.salesModel.executeQuery({ query: 'EVALUATE TOPN(10, Sales)' });
if (r.status === 'success') { r.table.columns; r.table.rows; }
else { r.error.category; r.error.message; }
```
Always select explicit columns, bound row counts, and branch on `status`.

## Security & deploy
Combine all of these: minimal operations in `rayfin.yml`, `@role` on connector entities, row policies and field rules where needed, and delegated auth. Deploy with `npx rayfin up`. Test as a user with rights on both the app and the source item.

Source: https://learn.microsoft.com/en-us/fabric/apps/connectors
