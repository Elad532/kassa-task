# kassa-task Monorepo

This is a pnpm monorepo using Turborepo, containing a NestJS backend, a Next.js frontend, and a shared types package.

## Requirements

- Node.js v20+
- pnpm

## Environment Variables

The API reads environment variables from `apps/api/.env`. Copy the example file and fill in the values:

```bash
cp apps/api/.env.example apps/api/.env
```

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string (Atlas or local) |

## New Dependencies

| Package | Location | Purpose |
|---|---|---|
| `zod` | `packages/common`, `apps/api` | Single source of truth for entity shapes |
| `nestjs-zod` | `apps/api` | Generates NestJS DTOs from Zod schemas |
| `@nestjs/config` | `apps/api` | Loads `.env` via `ConfigModule` |
| `mongodb-memory-server` | `apps/api` (dev) | In-memory MongoDB for unit tests |

## Setup

1.  **Install dependencies:**

    ```bash
    pnpm install
    ```

2.  **Set up environment variables:**

    ```bash
    cp apps/api/.env.example apps/api/.env
    # Edit apps/api/.env with your MONGODB_URI
    ```

3.  **Build shared packages:**

    ```bash
    pnpm --filter @kassa-task/common build
    ```

## Development

To start both the API and the web frontend in development mode with hot-reloading:

```bash
pnpm dev
```

-   **Web App:** Available at `http://localhost:3000`
-   **API:** Available at `http://localhost:3001`

## How It Works

### Frontend (Next.js)

The frontend is a standard Next.js application located in `apps/web`. The main page fetches a message from the backend and displays it.

### Backend (NestJS)

The backend is a NestJS application located in `apps/api`. It exposes:

-   `GET /api/hello`: Returns `{ "id": "1", "message": "hello world" }`.

#### Catalog API (read-only, backed by MongoDB Atlas)

| Method | Route | Query Params | Description |
|---|---|---|---|
| GET | `/api/catalog/products` | `category?`, `type?`, `minPrice?`, `maxPrice?` | Filter products (compound index) |
| GET | `/api/catalog/products/search` | `q` (required), `limit?` (default 20) | Full-text search on title + description |
| GET | `/api/catalog/products/:id` | — | Find by MongoDB ObjectId |

All query params are validated automatically via `ZodValidationPipe`. Invalid requests return `400` with field-level error details.

### Shared Types

The `packages/common` directory contains Zod schemas and TypeScript types shared between the `api` and `web` applications, ensuring type safety across the stack. Zod schemas in `packages/common` are the single source of truth — Mongoose schemas and NestJS DTOs are derived from them automatically.

### CORS and API Proxy

The Next.js application uses a rewrite rule in `next.config.js` to proxy requests from `/api/*` on the web server (`localhost:3000`) to the backend API server (`localhost:3001`).

```javascript
// apps/web/next.config.js
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:3001/api/:path*',
    },
  ]
}
```

This setup prevents Cross-Origin Resource Sharing (CORS) errors in the browser. The browser sends a request to its own origin (`http://localhost:3000/api/hello`), and the Next.js development server forwards it to the API server, so the browser never makes a cross-origin request.

## Testing

Tests are split into two suites in `apps/api`:

| Suite | Files | Command |
|---|---|---|
| Unit / integration | `src/**/*.spec.ts` | `pnpm --filter api test` |
| E2E (HTTP layer) | `test/**/*.e2e-spec.ts` | `pnpm --filter api test:e2e` |

**Run only unit tests (API):**

```bash
pnpm --filter api test
```

**Run only e2e tests (API):**

```bash
pnpm --filter api test:e2e
```

**Run both suites (API):**

```bash
pnpm --filter api test && pnpm --filter api test:e2e
```

**Run all unit tests across the monorepo** (Turborepo — does not include e2e):

```bash
pnpm test
```

## Production

To build all applications and packages for production:

```bash
pnpm build
```

To start the production-ready applications (after building):

```bash
pnpm start
```

This will run `node dist/main` for the `api` and `next start` for `web`.

## Troubleshooting

-   **Port Conflicts:** If `3000` or `3001` are in use, you can change the port in `apps/web/package.json` (for Next.js, using `next dev -p <port>`) and in `apps/api/src/main.ts` (for NestJS).
-   **Turbo Cache:** If you encounter unexpected behavior, you can clear the Turborepo cache: `turbo clean` or remove the `.turbo` directory.
-   **Common Package Build Issues:** If the `web` or `api` app has trouble importing from `@kassa-task/common`, ensure the common package is built correctly. You can force a rebuild by running `pnpm --filter @kassa-task/common build`.
