# Pathfortune Digital Audit — agency digital-health tool

Audits a client's website (live, real data — SEO fundamentals, accessibility, performance,
content, lead-gen, local SEO) and their social accounts, then generates a SWOT, a weighted
Digital Presence Score, an executive summary, and a 30/60/90 action plan.

**No login required** — open access by design. If you need to gate this behind auth later,
Netlify Identity was used in an earlier version of this build and can be re-added.

## Run it locally

```
npm install
cp .env.example .env   # add your Google API key (see below)
npm start
```

Open http://localhost:3000. Add a client, click "Run live audit."

## Deploy to Netlify

Netlify doesn't run a persistent Node server — it serves the `public/` folder as
static files and runs `netlify/functions/api.js` as a serverless function for
everything under `/api/*` (already wired up via `netlify.toml`). Client data is
stored with Netlify Blobs instead of the local JSON file, since serverless
functions can't write to disk.

1. **Push the code to GitHub** (if you haven't already):
   ```
   git init && git add . && git commit -m "initial"
   ```
   Create an empty repo on github.com, then follow its "push an existing repo"
   instructions to connect and push.

2. **Install the Netlify CLI** (optional but makes step 4 easy):
   ```
   npm install -g netlify-cli
   netlify login
   ```

3. **Create the site** — either at app.netlify.com ("Add new site" → "Import an
   existing project" → pick your GitHub repo), or from the CLI:
   ```
   netlify init
   ```
   Netlify will detect `netlify.toml` automatically — publish directory `public`,
   functions directory `netlify/functions`, build command `npm install`.

4. **Add your environment variables** in Site configuration → Environment
   variables (or `netlify env:set NAME value`):
   - `GOOGLE_PSI_API_KEY` — PageSpeed Insights
   - `X_BEARER_TOKEN` — optional, X/Twitter metrics
   - `MOZ_ACCESS_ID` / `MOZ_SECRET_KEY` — optional, off-page/backlinks
   - `SIMILARWEB_API_KEY` — optional, traffic estimates
   - `GOOGLE_PLACES_API_KEY` — optional, Local SEO / Google Business Profile
   - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`
     — for the Search Console/GA4 "Connect Google" flow (see lib/google/oauth.js
     for the exact Google Cloud setup steps)

   Netlify Blobs itself needs no setup or API key.

   **Storage architecture**: production (any Netlify Function invocation) always uses Netlify
   Blobs — it never falls back to a local file, which was the cause of an earlier `ENOENT`
   bug (esbuild bundles the whole app into `netlify/functions/api.js`, so a stray filesystem
   write inside that bundle has nowhere valid to land). Only plain local `npm start` opts into
   file-based storage, via `LOCAL_FS_STORAGE=true` set explicitly in `server.js` — nothing else
   triggers it.

5. **Deploy**:
   ```
   netlify deploy --prod
   ```
   or push to your connected branch — Netlify redeploys automatically. You'll
   get a URL like `https://your-site-name.netlify.app`.

To test the whole thing locally exactly as it runs on Netlify (functions +
Blobs + redirects together) before deploying, run `netlify dev` instead of
`npm start` — it needs the site linked first (`netlify init` or `netlify link`).

The app has no login — anyone with the URL can create clients and run audits.
Rate limiting (10 audits/hour per IP) and SSRF protection are in place, but
if you want to restrict who can access the site at all, put it behind
Netlify's password protection (Site configuration → Visitor access) or a
similar edge-level gate rather than reintroducing app-level auth.

## What's real vs. what needs your setup

Working with zero configuration: on-page SEO, content analysis, color palette,
image inventory, social link previews, competitor comparison, lead-generation
audit, weighted Digital Presence Score, executive summary, 30/60/90 roadmap,
PDF report download, audit history, admin dashboard, SSRF protection, and
rate limiting (10 audits/hour per user).

Working once you add a free API key: PageSpeed performance/SEO/accessibility
scores (`GOOGLE_PSI_API_KEY`), Local SEO / Google Business Profile data
(`GOOGLE_PLACES_API_KEY` — just an API key, no OAuth needed).

Working once a client connects their Google account: Search Console (clicks,
impressions, top queries) and GA4 traffic (sessions, users, channels) — via
the "Connect Google" button on that client's Google Search tab.

Needs a paid subscription to ever show real numbers (no free source exists
anywhere): off-page/backlink data (Moz/Ahrefs/SEMrush), and traffic estimates
for sites you don't own (SimilarWeb). Both show an honest "not connected"
message with the reason until you add credentials — they never show fabricated
numbers. The Digital Presence Score excludes any category with no real data
behind it and renormalizes the remaining weights, rather than guessing.

Not built yet: LLM-written strategy narration (kept rule-based per your
earlier decision), Postgres/Supabase migration, radar-chart competitor view
(currently a comparison table instead).

## What's live out of the box

- **Website audit** — fetches the client's real homepage and checks title, meta
  description, headings, alt text, viewport, canonical, HTTPS, Open Graph/Twitter
  Card tags, structured data, robots.txt, sitemap.xml. No API key needed.
- **PageSpeed Insights** (Performance/SEO/Accessibility/Best Practices scores) — needs
  a free key from https://developers.google.com/speed/docs/insights/v5/get-started.
  Works without one too, but Google heavily rate-limits unkeyed requests — get the key
  before running audits across a real client roster.

## What needs per-client setup (these are gated by the platforms, not by this tool)

- **Instagram** — client's account must be a Business/Creator account linked to a
  Facebook Page. Create a Meta app at https://developers.facebook.com/apps, add the
  Instagram Graph API product, generate a long-lived Page access token. Enter the
  IG user ID + token when you add the client.
- **X (Twitter)** — needs a developer account at https://developer.x.com and a Bearer
  Token. As of X's current API pricing, meaningful read access sits behind a paid tier.
- **LinkedIn / TikTok** — both require applying for partner/business API access and
  the client granting your app access to their Page/Business account — there is no
  self-serve public-metrics endpoint. `lib/socialConnectors/restricted.js` has the
  real request shapes ready to wire in once you're approved.

None of the connectors fabricate numbers — if credentials aren't connected for a
client, that platform's section just shows "not connected" with the reason.

## Architecture

```
server.js              Express app
routes/clients.js       add / list / remove clients
routes/audit.js         orchestrates: website audit + social pulls -> SWOT
lib/seoAudit.js         live website + PageSpeed checks
lib/swotEngine.js       rule-based SWOT + prioritized actions from audit data
lib/socialConnectors/   one file per platform, real API calls
lib/clientStore.js      client storage (data/clients.json)
public/index.html       dashboard UI
```

## Before running this for real clients

`data/clients.json` currently stores social access tokens in plain text on disk —
fine for local testing, not for production. Before putting this on a server other
people can reach:
- Move client storage to a real database (Postgres/SQLite) instead of the JSON file.
- Encrypt stored access tokens at rest, or better, use a secrets manager.
- Add authentication in front of the dashboard (it currently has none).
- Add rate limiting / caching so repeated audits don't hammer PageSpeed or the
  social APIs.

## Extending the SWOT logic

`lib/swotEngine.js` is a pure function — feed it `{ audit, social }` and it returns
`{ swot, actionPlan }`. Add rules there as you learn what actually matters for your
clients' industries (e.g., local-SEO checks for brick-and-mortar clients, review-site
presence for service businesses).
