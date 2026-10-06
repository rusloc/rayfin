# Rayfin Demo — Names Register

Fabric-authenticated names register on a Fabric Apps (Rayfin) backend: sign in with Microsoft Entra, save names into the app's SQL database, search, rename and delete them, see the full table. Each user sees only their own rows (row-level `@role` policy). Seeded from the Rayfin `todoapp` template; see `CLAUDE.md` and `docs/` for conventions, ADRs and the CI/CD checklist.

## Getting started

```bash
# Provision the Fabric backend and start the local dev server
npm run dev

# As needed, apply database migrations (one time, when running locally)
npm run rayfin:db
```

Open [http://localhost:5173](http://localhost:5173) to view the app.

## Project structure

```text
├── rayfin/
│   ├── rayfin.yml          # Fabric service configuration
│   └── data/
│       ├── Person.ts       # Person entity with @role-based per-user access
│       └── schema.ts       # Schema export consumed by the typed client
├── src/
│   ├── main.tsx            # Entry point + Rayfin client bootstrap
│   ├── App.tsx             # Routes and auth gate
│   ├── hooks/
│   │   └── AuthContext.tsx # React context wrapping the auth helpers
│   ├── components/
│   │   └── AuthPage.tsx    # Sign-in UI
│   ├── pages/
│   │   └── HomePage.tsx    # Names register UI (save, search, rename, delete, table)
│   └── services/
│       ├── IAuthService.ts        # Auth service contract + AuthUser type
│       ├── MockAuthService.ts     # Local-dev impl (email/password)
│       ├── RayfinAuthService.ts   # Production impl (Fabric brokered auth)
│       ├── rayfinClient.ts        # Typed Rayfin client singleton
│       ├── bootstrap.ts           # Reads env, picks the right auth service
│       └── people.ts              # Person CRUD + search wrappers (in-memory in local dev)
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Provision or reuse the Fabric backend and start local frontend/Functions code |
| `npm run build` | Production build |
| `npm run build:fabric` | Build for Fabric deployment (entrypoint for `rayfin up staticapp deploy`) |
| `npm run lint` | Lint with ESLint |
| `npm run test` | Run unit tests with Vitest |
| `npm run rayfin:up` | Deploy app to Fabric (no local dev server) |
| `npm run rayfin:db` | Apply database migrations |
