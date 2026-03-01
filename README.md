# kassa-task Monorepo

This is a pnpm monorepo using Turborepo, containing a NestJS backend, a Next.js frontend, and a shared types package.

## Requirements

- Node.js v20+
- pnpm

## Setup

1.  **Install dependencies:**

    ```bash
    pnpm install
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

The backend is a minimal NestJS application located in `apps/api`. It exposes a single endpoint:

-   `GET /api/hello`: Returns a JSON payload `{ "id": "1", "message": "hello world" }`.

### Shared Types

The `packages/common` directory contains TypeScript interfaces shared between the `api` and `web` applications, ensuring type safety across the stack.

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

To run all tests for all applications and packages:

```bash
pnpm test
```

This command uses Turborepo to run Jest tests in both the `api` and `web` projects.

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
