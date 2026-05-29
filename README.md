# gyygis

Monorepo for the gyygis project.

## Prerequisites

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/) 9.x (see `packageManager` in root `package.json`)

## Install

Run from the repository root:

```bash
pnpm install
```

## Environment (backend)

Before starting the server, configure environment variables:

1. Copy `packages/gyygis-server/.env.example` to `packages/gyygis-server/.env`.
2. Fill in the required keys (e.g. `TIANDITU_KEY` and any other variables described in the example file).

## Development

```bash
# API / backend
pnpm dev:server

# Map / core preview
pnpm dev:core

# Admin frontend
pnpm dev:admin

# User-facing frontend (Vue 3 + Vite; lives in packages/gyygis-view)
pnpm dev:view
```

The user app defaults to port **5176** and proxies `/api` to the backend (see `packages/gyygis-view/.env.development`). Production build: `pnpm build:view`.

### Offline map tiles (optional)

Tianditu (天地图) offline packs live under a **`tdt`** folder (other basemap sources can use sibling folders later). Set `OFFLINE_TILE_ROOT` in `packages/gyygis-server/.env` or `deploy/.env` (e.g. `/tiles` with packs at `/tiles/tdt/...`, or point directly at `/tiles/tdt`).

Layouts (both supported; do not name region packs with digits-only names like `7`):

- **Flat:** `{OFFLINE_TILE_ROOT or .../tdt}/{z}/{x}/{y}.png`
- **Regional packs (no merge):** `{.../tdt}/{pack-name}/{z}/{x}/{y}.png` — add/remove a city by copying or deleting `pack-name`

Optional `OFFLINE_TILE_REGION_ORDER=pack-a,pack-b` controls search order when a tile exists in multiple packs.

The view requests `/api/offline-tiles/{z}/{x}/{y}.png` (Tianditu / `tdt`) first, then may fall back to online when `MAP_ONLINE_POLICY` is `auto` or `on`.
