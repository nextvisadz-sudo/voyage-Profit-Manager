# Next Visa Travel

A travel agency web platform with a customer-facing hotel search site and a separate admin dashboard for managing commission rates.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/commission.ts` — DB schema: `commission_config`, `search_stats` tables
- `artifacts/api-server/src/routes/hotels.ts` — Hotel search proxy (fetches from H24Voyages, applies commission)
- `artifacts/api-server/src/routes/commission.ts` — Commission CRUD and stats endpoints
- `artifacts/travel-website/` — Customer-facing travel site (React+Vite, served at `/`)
- `artifacts/admin-dashboard/` — Admin dashboard (React+Vite, served at `/dashboard/`)
- Logo: `attached_assets/next_visa_logo_nobg.png` — background removed; copied to `artifacts/travel-website/public/logo.png`

## Architecture decisions

- H24Voyages API is proxied server-side; commission markup is applied before sending prices to the frontend. Clients never see original prices.
- If the H24Voyages API is unavailable, the backend falls back to mock hotel data so the website always renders results.
- Commission config and search stats are persisted in PostgreSQL via Drizzle ORM.
- Both frontend apps share a single `@workspace/api-client-react` package generated from the OpenAPI spec.

## Product

- **Travel Website** (`/`): Search hotels by destination/dates/guests, browse results with commission-adjusted prices, view hotel details.
- **Admin Dashboard** (`/dashboard/`): View search stats (total searches, hotels served), configure the profit commission % (0-100), preview how the commission affects pricing.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` before using the updated types.
- The commission is applied server-side in `hotels.ts` — do not apply it again on the frontend.
- H24Voyages API response shape is unknown; the parser in `hotels.ts` tries multiple field names and falls back to mocks if the response is non-200.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
