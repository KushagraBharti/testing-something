# Pulse Kit

Pulse Kit is a production-ready monorepo that ships **IdeaEngine** and **ReplyCopilot** for X creators. It consists of a Vite + React control center, a Hono edge API, and a Chrome extension powered by CRXJS. The stack is optimized for BYO model keys, Supabase storage, and strict JSON contracts validated with Zod.

## Highlights

- 🧠 **IdeaEngine** clusters the current X timeline and drafts 5–6 hooks with outline bullets, virality scores, and trend notes.
- 💬 **ReplyCopilot** generates three on-brand reply angles (insight, question, example) and inserts them into the X composer with one click.
- 🧭 **Control Center Web App** (Vite + React + Tailwind + MUI) handles X login flow, style profile editing, model preferences, and BYO key storage.
- ⚡ **Edge API** (Hono + TypeScript) runs on Cloudflare Workers / Vercel Edge, handles JWT auth, Supabase persistence, OpenAI/xAI providers, strict JSON validation, and retry logic.
- 🧩 **Chrome Extension** (Vite + CRXJS + React + MUI) overlays a side panel on x.com, captures DOM snippets on demand, and calls the API via a rate-limited background worker.
- ✅ **Shared Package** centralizes Zod schemas, selector utilities, prompt templates, and type definitions for all runtimes.
- 🧪 **Tests Everywhere** using Vitest: schema/unit tests in `packages/shared`, API route tests in `apps/api`, DOM extraction tests in `apps/extension`, and component smoke tests in the web app.

## Monorepo Layout

```
pulse-kit/
├── apps/
│   ├── api/          # Hono edge API (wrangler dev / Vercel ready)
│   ├── extension/    # CRXJS + React Chrome MV3 extension
│   └── web/          # Vite + React control center (Tailwind + MUI)
├── packages/
│   └── shared/       # Zod schemas, types, prompts, DOM selectors, utils
├── infra/
│   └── github-actions/ci.yml (optional GitHub Actions pipeline)
├── .yarnrc.yml, package.json, yarn.lock, ...
└── README.md
```

Every workspace exposes `dev`, `build`, `test`, and `lint` scripts, and the root package.json provides convenience scripts for running each app from the monorepo root (e.g. `yarn dev:web`).

## Prerequisites

- Node.js 18+
- Yarn (v4 via Corepack) — already configured via `.yarnrc.yml`
- Supabase project (free tier) with the tables described below
- OpenAI/xAI keys (optional, users can provide their own)

## Installation

```bash
yarn install          # installs dependencies for all workspaces
yarn --cwd packages/shared build  # generate shared package dist (optional for dev)
```

Copy `.env.example` to `.env` at the repo root and fill in the shared environment variables. Each app also has its own `.env.example`; copy and customize as needed (`apps/web/.env`, `apps/extension/.env`, `apps/api/.env`).

## Running the stack locally

### 1. Edge API (Cloudflare Workers dev server)

```bash
yarn dev:api  # alias for yarn --cwd apps/api dev (wrangler dev)
```

The API defaults to `http://localhost:8787`. Update `API_BASE_URL` accordingly in your `.env` files.

### 2. Web Control Center

```bash
yarn dev:web  # alias for yarn --cwd apps/web dev
```

This launches Vite on `http://localhost:5173` with Tailwind + MUI styling. Log in with X, mint a demo session, update style profile, and copy the extension token.

### 3. Chrome Extension

```bash
yarn dev:ext  # alias for yarn --cwd apps/extension dev (CRXJS HMR server)
```

- Visit `chrome://extensions`
- Enable “Developer Mode”
- Click “Load unpacked” and select `apps/extension/dist` after running `yarn --cwd apps/extension build`, or use the CRXJS dev server output (`dist` is regenerated automatically).

The extension injects a floating side panel on x.com with IdeaEngine and ReplyCopilot tabs. It communicates with the API through a background worker that stores the JWT in `chrome.storage.local`, enforcing a simple token bucket rate limiter to avoid spamming the edge API.

## Testing

```bash
yarn --cwd packages/shared test
yarn --cwd apps/api test
yarn --cwd apps/web test
yarn --cwd apps/extension test
```

The GitHub Actions workflow in `infra/github-actions/ci.yml` runs these suites plus linting/build checks on every push.

## Building for production

```bash
yarn --cwd apps/api build        # tsup bundle for edge deployment
yarn --cwd apps/web build        # production Vite build
yarn --cwd apps/extension build  # CRXJS production bundle (packed to dist/)
```

## Environment & Supabase Schema

Root `.env.example` lists the shared secrets:

```
OPENAI_API_KEY=
XAI_API_KEY=
X_API_BEARER=
SUPABASE_URL=
SUPABASE_ANON_KEY=
JWT_SECRET=change_me
API_BASE_URL=http://localhost:8787
```

Tables expected in Supabase (SQL types simplified):

- `users(id uuid pk, x_user_id text, handle text, avatar_url text, created_at timestamptz)`
- `settings(user_id uuid, model text default 'openai', temp float default 0.7, want_trends bool default false, trend_sources_max int default 1)`
- `style_profiles(user_id uuid, voice text, cadence text, sentence_len text, favorite_phrases text, banned_words text, updated_at timestamptz)`
- `keys(user_id uuid, provider text, enc_key text, updated_at timestamptz)` (BYO provider keys encrypted server-side)

The API uses Supabase’s JavaScript client with sessionless service calls (anon key). For production you should swap to service role keys + RLS policies.

## Deployment Notes

### API
- **Cloudflare Workers**: `wrangler dev` already works; run `wrangler deploy` with a proper `wrangler.toml` (provided in `apps/api`).
- **Vercel Edge**: Hono exports are compatible; point `vercel.json` to the compiled `dist/index.js`.

### Web App
- Push the Vite build (`apps/web/dist`) to any static host (Vercel, Netlify, Cloudflare Pages). Configure `VITE_API_BASE_URL` and `VITE_X_CLIENT_ID` in production.

### Chrome Extension
- Run `yarn --cwd apps/extension build`
- Zip the `apps/extension/dist` folder
- Upload to the Chrome Web Store (one-time developer fee). The manifest already meets MV3 requirements.

## BYO Keys & Style Profile Sync

- Users can paste OpenAI, xAI, and X bearer tokens in the Settings screen. Keys are encrypted on the server via AES-GCM (Supabase storage) and never exposed to the extension.
- Style profile edits are stored locally in the web app for instant feedback and broadcast to the extension via `chrome.runtime` messaging so IdeaEngine/ReplyCopilot stay on-brand.
- The extension defaults to a sensible voice and uses user-provided settings whenever available.

## Policies & Safeguards

- The extension performs **user-initiated DOM capture only**. No background crawling, no scheduled scrapes.
- API responses are validated with Zod and retried once when models output invalid JSON.
- Background worker uses a simple token bucket (4 requests per 15s) to prevent accidental spam.
- JWTs are short lived and refreshed via `/auth/refresh`; extension copies a fresh token from the web control center.

## License

MIT © 2025 Pulse Kit contributors
