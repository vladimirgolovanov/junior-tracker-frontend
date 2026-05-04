# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (proxies /auth/* and /api/* to localhost:8000)
npm run build     # tsc + vite build
npm run lint      # ESLint check
npm run preview   # Preview production build
```

No test framework is configured.

## Environment

Single env var: `VITE_API_BASE` — overrides the API base URL (defaults to current origin). The Vite dev proxy handles routing to `localhost:8000` automatically.

## Architecture

React 18 + TypeScript SPA built with Vite. Routing via React Router v7 (BrowserRouter). State via Zustand. API calls via `openapi-fetch` with auto-generated types from the backend's OpenAPI spec.

**Auth flow:** JWT token stored in `localStorage` (key `"token"`). `useAuthStore` (`src/store/auth.ts`) provides the token and `logout`. A middleware in `src/api/client.ts` injects the Bearer header on every request and calls `logout` on any 401 response.

**Data flow:** `useChildrenStore` (`src/store/children.ts`) fetches and caches the child list in localStorage. A module-level `isFetching` flag prevents duplicate in-flight requests. `useChildren` hook (`src/hooks/useChildren.ts`) triggers the fetch when a token is present.

**Routing:** `RequireAuth` wraps protected routes. Unknown routes redirect to `/chart`. `LoginPage` and `RegisterPage` are public; `ChartPage` requires auth.

**Key files:**
- `src/api/client.ts` — openapi-fetch client setup with token middleware
- `src/api/schema.d.ts` — **auto-generated**, do not edit manually
- `src/components/Layout.tsx` — header nav + "Add event" modal form
- `src/pages/ChartPage.tsx` — main feature: sleep charts and dashboard, timezone-aware

**API conventions:** Most calls use the typed openapi-fetch client. Some endpoints in `ChartPage` use native `fetch()` directly. Form submissions use the `FormData` API with native HTML forms.

**Styling:** Plain CSS, no preprocessor. Global layout and responsive styles in `src/index.css`.
