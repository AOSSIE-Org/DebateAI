# Frontend Error Reporting

This project includes a small, best-effort error reporting flow for React runtime errors.

- `frontend/src/components/ErrorBoundary.tsx` - Global and route-level React Error Boundary.
- `frontend/src/components/ErrorFallback.tsx` - Basic fallback UI with a "Try again" button.
- `frontend/src/utils/errorReporting.ts` - Console + beacon/fetch reporter; will also call the Sentry wrapper if configured.
- `frontend/src/utils/sentry.ts` - Optional Sentry wrapper. Controlled by `VITE_SENTRY_DSN`.

Configuration
1. To enable Sentry, set `VITE_SENTRY_DSN` in your environment (e.g., in `.env`):

```
VITE_SENTRY_DSN=https://<public-key>@o0.ingest.sentry.io/<project-id>
```

2. Install Sentry SDKs and test:

```
cd frontend
npm install
npm install @sentry/react @sentry/tracing --save
npm run dev
```

3. Optional: configure backend endpoint `/api/frontend/errors` to receive POSTs from the browser.

Running tests

```
cd frontend
npm install
npm run test
```
