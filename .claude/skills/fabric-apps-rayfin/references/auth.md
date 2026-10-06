# Authentication

| Where | Method | `rayfin.yml` |
|---|---|---|
| Local dev | Email + password | `services.auth.password.enabled: true` |
| Deployed | Fabric SSO (Entra ID) | `services.auth.fabric.enabled: true` |

- `services.auth.enabled: true` is mandatory; `rayfin up` fails without it.
- Password sign-in stops working after deploy. SSO needs the Fabric portal, so it can't be used locally.
- Put the local origin in `allowedRedirectUris`; `rayfin up` adds the deployed origin.
- First SSO sign-in provisions the user; there is no separate sign-up.
- Package `@microsoft/rayfin-auth-provider-fabric` ships with scaffolded projects; otherwise `npm install` it. Don't use the deprecated callback helpers.

## Options
```ts
const fabricOptions = {
  workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID,
  projectId: import.meta.env.VITE_FABRIC_ITEM_ID,          // the app item id
  fabricPortalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL, // e.g. https://app.fabric.microsoft.com
  returnOrigin: window.location.origin,                    // bare origin (no path); must be in allowedRedirectUris
  // fabricEmbedded: true  // force embedded; otherwise auto-detected from ?fabricEmbedded=true
};
```

## API
| Call | When |
|---|---|
| `initEmbeddedAuth(client.auth, opts)` | App startup. Inside a Fabric iframe it gets the session from the parent frame; elsewhere returns `null`. Safe on page load. |
| `ensureSignedInWithFabric(client.auth, opts)` | Sign-in button. Tries existing session → silent refresh → embedded → popup. The popup step needs a synchronous user gesture (`onClick`): never on load, never after an `await`. |
| `client.auth.getSession()` | Current session: `isAuthenticated`, `user.id`, `user.email`, custom claims. Opaque; never parse tokens. |
| `client.auth.onSessionChange(cb)` | Subscribe to sign-in/out; returns an unsubscribe function. |
| `client.auth.signOut()` | End session, clear cached tokens. |
| `client.auth.signIn({ email, password })` | Local dev only. |
| `initiateFabricLogin(auth, opts)` / `isEmbeddedMode(opts)` | Low-level popup flow / embedded detection. |

## Wiring contract (framework-agnostic)
1. One shared `RayfinClient`.
2. On startup: `await initEmbeddedAuth(...)`.
3. Unauthenticated → render a "Sign in with Fabric" control whose click handler calls `ensureSignedInWithFabric(...)` directly.
4. Mirror `onSessionChange` into UI state; gate data calls on `isAuthenticated`.

Framework specifics (hooks, route guards, components) belong to the front-end skill; hand it this contract.

## Built-in security (don't reimplement)
Popup → Entra in the Fabric portal → `window.opener.postMessage` handoff → SDK exchanges the code for a session. Protected by PKCE S256, a state nonce and `postMessage` origin validation. The flow and PKCE state expire after 5 minutes.

## Troubleshoot
- Popup blocked → the call is not inside a synchronous gesture handler.
- Session not persisting → wrong `baseUrl` / `publishableKey`, or callback tab on another origin (`BroadcastChannel` / `localStorage` need the same origin).
- Fails after a delay → over 5 minutes elapsed; restart the flow.

## Custom claims
`services.auth.customClaims` in `rayfin.yml` → present in the session and usable in `@role` policies (`data-model.md`).

Sources:
- https://learn.microsoft.com/en-us/fabric/apps/authentication
- https://learn.microsoft.com/en-us/fabric/apps/fabric-authentication
