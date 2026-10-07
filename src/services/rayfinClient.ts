import {
  ConnectorsRayfinClient,
  resolveRayfinConfig,
  type FunctionsSchema,
  type RayfinRuntimeConfig,
} from '@microsoft/rayfin-client';
import { fabricSemanticModel } from '@microsoft/rayfin-connector-fabric-semanticmodel';

import { connectorConfig as comsreportConfig } from '../../rayfin/connectors/comsreport/schema';
import type { AppConnectorsSchema } from '../../rayfin/connectors/schema';
import type { AppSchema } from '../../rayfin/data/schema';

/** The app's client: data entities + the connectors declared in rayfin.yml. */
export type AppRayfinClient = ConnectorsRayfinClient<
  AppSchema,
  FunctionsSchema,
  AppConnectorsSchema
>;

export interface RayfinClientConfig {
  baseUrl: string;
  publishableKey: string;
  /** True when the API URL points at localhost. Exposed via {@link isLocalBackend}. */
  localDev: boolean;
  /** Absolute same-origin URL for local Functions calls when the Vite adapter is active. */
  functionsBaseUrl?: string;
  /** Fabric coordinates fallback for local dev, where no runtime config is emitted. */
  runtimeConfig?: RayfinRuntimeConfig;
}

let client: AppRayfinClient | null = null;
let localDev = false;

export async function initRayfinClient(
  config: RayfinClientConfig
): Promise<AppRayfinClient> {
  if (client) {
    throw new Error('Rayfin client is already initialized.');
  }
  const resolved = await resolveRayfinConfig({
    apiUrl: config.baseUrl,
    publishableKey: config.publishableKey,
    ...config.runtimeConfig,
  });
  client = new ConnectorsRayfinClient<
    AppSchema,
    FunctionsSchema,
    AppConnectorsSchema
  >(
    {
      // resolved.baseUrl/publishableKey are always set: config.baseUrl/publishableKey
      // are non-optional defaults, so the resolve step can only overlay on top of them.
      baseUrl: resolved.baseUrl!,
      publishableKey: resolved.publishableKey!,
      authStorage: true,
      functionsBaseUrl: config.functionsBaseUrl,
      runtimeConfig: resolved.runtimeConfig,
      // Routing config per connector, keyed by the rayfin.yml connector name.
      connectors: { comsreport: comsreportConfig },
    },
    // Runtime hooks per connector: decodes the Arrow/JSON response and
    // normalises executeQuery into SemanticModelQueryResult.
    { comsreport: fabricSemanticModel() }
  );
  localDev = config.localDev;
  return client;
}

export function getRayfinClient(): AppRayfinClient {
  if (!client) {
    throw new Error(
      'Rayfin client not initialized. Call bootstrapAuth() first.'
    );
  }
  return client;
}

/** True when the app was bootstrapped against a localhost backend. */
export function isLocalBackend(): boolean {
  return localDev;
}
