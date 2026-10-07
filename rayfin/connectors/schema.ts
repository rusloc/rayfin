// Hand-written registry of every connector declared in rayfin.yml.
// Keys must match the `name` in rayfin.yml exactly; the per-connector
// `schema.ts` files are CLI-generated and must not be edited.

import type { ComsreportSchema } from './comsreport/schema.js';

export type AppConnectorsSchema = {
  comsreport: ComsreportSchema;
};
