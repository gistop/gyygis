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
