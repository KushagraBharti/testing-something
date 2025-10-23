# Pulse Kit

Pulse Kit is a production-ready monorepo that ships **IdeaEngine** and **ReplyCopilot** for X creators. It bundles a Vite + React control center, a Hono edge API, and a Chrome extension powered by CRXJS. The stack is optimized for BYO model keys, Supabase storage, and strict JSON contracts validated with Zod.

## Highlights

- 🧠 **IdeaEngine** clusters your X timeline and drafts 5–6 hooks with outline bullets, virality scores, and optional trend sparks.
- 💬 **ReplyCopilot** produces three on-brand reply angles (insight, question, example) and inserts directly into the composer.
- 🕹️ **Control Center Web App** (Vite + React + Tailwind + MUI) manages login, style profiles, model preferences, and BYO keys.
- ⚡ **Edge API** (Hono + TypeScript) runs on Cloudflare Workers / Vercel Edge, handles JWT auth, Supabase persistence, and strict JSON enforcement with automated retries.
- 🧩 **Chrome Extension** (Vite + CRXJS + React + MUI) injects a polished side panel, captures DOM snippets on demand, and calls the API through a rate-limited background worker.
- ♻️ **Shared Package** centralizes Zod schemas, selector utilities, prompt templates, and helpers for all runtimes.
- ✅ **Tests Everywhere** using Vitest: schemas in `packages/shared`, API contract tests in `apps/api`, DOM fixtures in `apps/extension`, and component smoke tests in the web app.
- 📊 **Cost Meter & Analytics** tracks trend spend per user (24h rolling) and offers an opt-in usage analytics toggle for anonymous quality metrics.

## Monorepo Layout

```
pulse-kit/
├── apps/
│   ├── api/          # Hono edge API (wrangler dev / Vercel ready)
│   ├── extension/    # CRXJS + React Chrome MV3 extension
│   └── web/          # Vite + React control center (Tailwind + MUI)
├── packages/
│   └── shared/       # Zod schemas, types, prompts, selectors, utils
├── infra/
│   └── github-actions/ci.yml
├── package.json
├── yarn.lock
└── README.md
```

Every workspace exposes `dev`, `build`, `test`, and `lint` scripts. The root `package.json` adds convenience scripts such as `yarn dev:web`, `yarn dev:ext`, `yarn dev:api`, and `yarn qa`.

## Prerequisites

- Node.js 18+
- Yarn (v4 via Corepack) – already configured via `.yarnrc.yml`
- Supabase project (free tier) with the tables described below
- Optional OpenAI / xAI / X API keys (users can supply their own)

## Installation

```bash
yarn install
```

Copy `.env.example` to `.env` at the repo root and fill in the shared environment variables. Do the same for each app (`apps/web/.env`, `apps/extension/.env`, `apps/api/.env`).

### Root `.env` variables

```
OPENAI_API_KEY=
XAI_API_KEY=
X_API_BEARER=
SUPABASE_URL=
SUPABASE_ANON_KEY=
JWT_SECRET=change_me
API_BASE_URL=http://localhost:8787
WEB_ORIGIN=http://localhost:5173
EXTENSION_ORIGIN=chrome-extension://your-extension-id
BYO_ENCRYPTION_KEY=
SESSION_TOKEN_SECRET=
```

The web app also expects:

```
VITE_API_BASE_URL=http://localhost:8787
VITE_X_CLIENT_ID=
VITE_SESSION_TOKEN_SECRET=
```

## Running the stack locally

1. **Edge API** (Cloudflare Workers dev server)
   ```bash
   yarn dev:api
   ```
2. **Web Control Center** (Vite dev server)
   ```bash
   yarn dev:web
   ```
3. **Chrome Extension** (CRXJS HMR)
   ```bash
   yarn dev:ext
   ```
   - Visit `chrome://extensions`
   - Enable “Developer Mode”
   - Click “Load unpacked” and select `apps/extension/dist` after running a build, or use the CRXJS dev output.

## Testing & QA

Run individual suites:

```bash
yarn --cwd packages/shared test
yarn --cwd apps/api test
yarn --cwd apps/web test
yarn --cwd apps/extension test
```

Or run the consolidated smoke sweep:

```bash
yarn qa
```

## Building for production

```bash
yarn --cwd apps/api build        # tsup bundle for edge deployment
yarn --cwd apps/web build        # production Vite build
yarn --cwd apps/extension build  # CRXJS production bundle (dist/)
```

## Supabase schema & security notes

Tables expected in Supabase (types simplified):

- `users(id uuid pk, x_user_id text, handle text, avatar_url text, created_at timestamptz)`
- `settings(user_id uuid, model text default 'openai', temp float default 0.7, want_trends bool default false, trend_sources_max int default 1)`
- `style_profiles(user_id uuid, voice text, cadence text, sentence_len text, favorite_phrases text, banned_words text, updated_at timestamptz)`
- `keys(user_id uuid, provider text, enc_key text, updated_at timestamptz)` (BYO provider keys encrypted AES-GCM server-side)
- `events(user_id uuid, event text, feature text, duration_ms float8, trends_used bool, sources_used int, created_at timestamptz)` (optional analytics events table)

> **RLS guidance:** use Supabase Row Level Security with a service-role key server-side. Never expose privileged keys to clients.

## Permissions & CSP posture

The MV3 manifest requests only `storage`, `activeTab`, and `scripting` permissions plus host access to `https://x.com/*` and `https://twitter.com/*`. We rely on Chrome’s default MV3 Content Security Policy—no remote code, no eval, and all bundling handled by Vite/CRXJS.

## Trend sparks & xAI tool-calling

The API uses the xAI tool-calling interface (legacy Live Search API is deprecated on **Dec 15, 2025**). Trend retrieval honours `trend_sources_max`, preferring sources `X` then `News`, and logs estimated cost at **$25 per 1000 sources** (~$0.025 per source). Cost logs surface as `[xai-trends]` entries in the API console.

The trends endpoint also records a 24h rolling spend and call count. You can inspect it via `GET /metrics/trends` (requires auth) and the Settings screen shows a live badge.

## Keyboard shortcuts & panel usage

Inside the extension panel:

- `Alt + I` focuses the IdeaEngine tab
- `Alt + R` focuses ReplyCopilot
- `Esc` closes the panel (and resets background rate limiting)
- Non-blocking toasts surface throttling, missing posts, or network errors
- Loading states use a subtle pulse indicator; cards lift slightly on hover to mirror X’s motion
- Opening/closing the panel emits anonymous analytics events when opt-in is enabled.

## BYO keys & style profile sync

- Users can paste OpenAI, xAI, and X bearer tokens on the Settings page. Keys are encrypted with AES-GCM using a server-side key before storage—plaintext never leaves the API.
- Style profile edits persist locally and broadcast to the extension via `chrome.runtime` messaging so both surfaces stay in sync.

## Usage analytics (opt-in)

- A toggle labeled **Help improve Pulse Kit** lives in Settings and is OFF by default.
- When enabled, the API logs anonymous counters (feature name, duration, trend usage) to the `events` table and the extension emits `panel_open` / `panel_close` events—never content or secrets.
- The toggle propagates to the extension and background worker instantly so analytics requests are suppressed when disabled.

## Policies & safeguards

- The extension performs **user-initiated DOM capture only**. No background crawling or scheduled scrapes.
- API responses are validated with Zod, clamped (hooks ≤ 18 words, bullets ≤ 140 visible chars), and retried once with a “STRICT JSON ONLY” reminder when a model drifts.
- The background worker enforces per-feature token buckets (IdeaEngine: 1 req/8s, ReplyCopilot: 3 req/10s) and refreshes JWTs on 401 responses.
- JWTs are short lived (15 minutes) and refresh tokens rotate via `/auth/refresh`.
- A global API limiter caps usage at **60 requests per hour** per user, returning `429 { "error": "rate_limited" }` when exceeded.

## Runbook

### Local run

```bash
yarn dev:api
yarn dev:web
yarn dev:ext
```

### Smoke steps

1. Open the control center at `http://localhost:5173`, use the demo session, and update your style profile.
2. Load the extension (CRXJS dev output or built `dist/`), open X home, and press **Alt + I** → run IdeaEngine.
3. Toggle “Include Today’s Sparks” to exercise the trend path (watch API logs for `[xai-trends] … estimated_cost_usd`).
4. Navigate to a tweet permalink, press **Alt + R**, and insert a reply – confirm the composer receives the text.
5. Remove the panel with `Esc`, reopen, and confirm rate limiting resets.
6. In Settings, confirm the “Trend spend (24h)” badge reflects calls and updates after running IdeaEngine, and try the “Help improve Pulse Kit” toggle (opt-in analytics).

### Inspecting trend cost logs

Run `yarn dev:api` and watch the console. Successful trend requests emit:

```
[xai-trends] { sources_used: ['X', 'News'], estimated_cost_usd: 0.05 }
```

You can also call `GET /metrics/trends` (authenticated) to see `{ estimated_usd_rolling_24h, calls_24h }` per user.

## Deployment notes

### API
- Cloudflare Workers: `wrangler dev` / `wrangler deploy`
- Vercel Edge: point build output at `apps/api/dist/index.js`

### Web app
- Deploy `apps/web/dist` to Vercel / Netlify / Cloudflare Pages. Configure production env vars (`VITE_API_BASE_URL`, `VITE_X_CLIENT_ID`, `VITE_SESSION_TOKEN_SECRET`).

### Chrome extension
- Build via `yarn --cwd apps/extension build`
- Zip `apps/extension/dist`
- Upload to Chrome Web Store (one-time developer fee)

## Trend cost model

IdeaEngine trend sparks cost roughly **$0.025–$0.05 per click** (1–2 sources at $25/1000). The API logs the estimated spend per request so you can track usage.

## License

MIT © 2025 Pulse Kit contributors
