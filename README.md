# The Spot NYC — owner portal

A private, read-only portal for the owners of **The Spot NYC** (formerly The Malthouse, West Village) at 206 Thompson Street. After logging in, an owner sees the venue’s HubSpot deals, leads, and activity: pipeline, sources, contacts, emails, notes, tasks, calls, meetings, and Project Blue texts.

The app talks to the HubSpot CRM REST API with a private-app token. There are **no AI or LLM calls** at runtime. A view costs nothing beyond hosting.

The header uses the HubSpot company logo URL from the survey. That file is currently HubSpot’s generic building placeholder (a small PNG), so the wordmark “The Spot NYC” is what carries the name. Colors follow the public site: forest green and butter gold on warm paper, set in Instrument Serif and Instrument Sans.

Demo mode ships with sample data so the app can be previewed with no token. The yellow banner on every page means you are not looking at live HubSpot.

## What it shows

Deals are included only when `venue_options` is one of:

- `The Spot` (label: The Spot (Formally Known as The Malthouse))
- `Malthouse Greenwich / West Village`

`venue_options = Malthouse` is **Malthouse FiDi** and is excluded. The portal does not join on the Spot company record (it has no associated deals) and does not search deal names for the word “Spot”.

All of these deals are in the Events pipeline (`default`). Stage labels come from `GET /crm/v3/pipelines/deals`. If that call fails, the app falls back to the stage list documented on Nov 17, 2026.

The default view is **open deals** (`hs_is_closed` is false). That includes Unqualified (`1378340530`), which HubSpot does not mark closed. Two toggles change the view:

- **Hide unqualified** drops stage `1378340530`.
- **Show closed won / lost** adds closed deals.

The board and table can be searched and filtered by stage, owner, deal source, and event date, and sorted by last activity, create date, event date, amount, guests, name, or stage. “Last activity” is `notes_last_updated`.

A deal page loads the deal, its contacts, and a single timeline of engagements associated to the deal **and** to those contacts. The same record is shown once. If it is only on the contact, it is labeled as contact-only, because that contact may also have deals at other venues.

The activity page is the recent feed across Spot deals (deal associations, plus Project Blue reply flags on their contacts).

## Demo mode

Demo mode is on when any of these is true:

- `DEMO_MODE=true`
- `DEMO_MODE` is unset **and** `HUBSPOT_PRIVATE_APP_TOKEN` is empty

`DEMO_MODE=false` forces live mode. If the token is missing, HubSpot calls fail with a clear error instead of silently showing fake data.

Built-in logins work only in demo mode, and only when you have not configured real accounts:

| Email | Password |
|---|---|
| `owner@thespot-nyc.com` | `demo-spot-2026` |
| `kayleen@thespot-nyc.com` | `demo-kayleen-2026` |

Both accounts see the same venue book. Logins are for access, not for splitting deals by person.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. With an empty token you get demo mode.

```bash
npm test
npm run lint
npm run build
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `HUBSPOT_PRIVATE_APP_TOKEN` | Live mode | Private app token. Read scopes only. Never commit it. |
| `SESSION_SECRET` | Live mode | Signs the session cookie. At least 16 characters. `openssl rand -base64 32` |
| `DEMO_MODE` | No | `true`, `false`, or unset (auto). |
| `OWNER_USERS` | Live mode | JSON array of owner accounts. See below. |
| `OWNER_USERS_FILE` | No | Path to a JSON file of accounts. Defaults to `data/users.json` (gitignored). |
| `CACHE_TTL_SECONDS` | No | Memory cache lifetime. Clamped to 120–300. Default 180. |

Demo mode will sign cookies with a built-in secret if `SESSION_SECRET` is unset. Do not rely on that in production.

## HubSpot private app scopes

Create a private app in the I&M portal (Settings → Integrations → Private Apps). Grant **read** scopes only. Do not grant any `.write` scope. The server refuses every HubSpot path that is not a known read.

### Required

| Scope | Why |
|---|---|
| `crm.objects.deals.read` | Search and read deals. Also used to read deal pipelines. |
| `crm.objects.contacts.read` | Read contacts, and the engagement records HubSpot authorizes with the contacts scope: notes, calls, tasks, and meetings, including associations. |
| `crm.objects.owners.read` | Resolve `hubspot_owner_id` to a name. |
| `sales-email-read` | Read one-to-one email subject, direction, and body (`hs_email_text` / `hs_email_html`). |

### Required for Project Blue / SMS bodies

| Scope | Why |
|---|---|
| `crm.objects.communications.read` | Read the Communications object (type id `0-18`): `hs_communication_channel_type`, `hs_communication_body`, and `hs_timestamp`. |

The app probes:

- `GET /crm/v3/objects/communications`
- if that 404s, `GET /crm/objects/2026-09/communications`
- then associations at `/crm/v4/objects/{deals\|contacts}/{id}/associations/communications` (and `0-18` if the name 404s)

If the token gets **403**, the deal page still shows contact flags `linq_sms_reply_received` and `linq_sms_reply_received_date` as **Project Blue SMS reply received** events, and it names the scope HubSpot asked for (falling back to `crm.objects.communications.read`). Those flags do not contain the message body. The workflow that sets them is “Project Blue - Inbound SMS Detector”; it does not copy the text onto the contact.

If the Communications endpoints **404**, the same flags are shown and the page says the object is not available to this token.

### If HubSpot names another scope

Some portals return `MISSING_SCOPES` with a granular name such as `crm.objects.notes.read`, `crm.objects.calls.read`, `crm.objects.meetings.read`, or `crm.objects.tasks.read`. Those names are often absent from the private-app scope picker; `crm.objects.contacts.read` is the scope HubSpot documents for those objects. If a call fails, the page quotes the scope from the error. Add it when the picker offers it.

`crm.schemas.deals.read` is optional. Pipeline labels already load with `crm.objects.deals.read`. If they do not, the documented Events stages are used and a warning is shown.

`crm.objects.companies.read` is **not** required. The logo is the public company logo URL. Zero deals are associated with the Spot company, so the portal does not use it as a filter.

## Add an owner login

Passwords are stored as scrypt hashes. The app never writes them back to HubSpot.

```bash
npm run hash-password
# or: npm run hash-password -- 'a long passphrase'
```

Then either set `OWNER_USERS` (one line of JSON):

```json
[
  {"email":"owner@thespot-nyc.com","name":"Venue owner","passwordHash":"scrypt$..."},
  {"email":"kayleen@thespot-nyc.com","name":"Kayleen Rosario","passwordHash":"scrypt$..."}
]
```

or copy `users.example.json` to `data/users.json` (that path is gitignored) and paste the hashes. `OWNER_USERS` wins over the file.

Configuring any real account turns off the built-in demo passwords, including in demo mode.

Sessions are httpOnly, SameSite=Lax cookies, valid for 7 days. In production the cookie is marked Secure. Every page and API route except login, logout, and static assets checks the cookie.

## Caching and HubSpot limits

Deal search, owners, pipelines, the communications probe, each deal timeline, and the activity feed are cached in memory for 2–5 minutes (default 3). The cache is per server instance. The first request after a cold start pages through every matching deal (100 per HubSpot search page, about 620 deals as of Nov 17, 2026) and then serves later views from memory.

Calls are spaced at least 180ms apart and retried on HTTP 429 and 5xx, honoring `Retry-After` up to three times. Search stops after 2,500 deals and shows a warning if more remain.

## Deploy on Vercel

1. Import this repository. Framework preset: **Next.js**. Do not set a custom build command.
2. Environment variables for the production project:
   - `HUBSPOT_PRIVATE_APP_TOKEN` — the private app token
   - `SESSION_SECRET` — `openssl rand -base64 32`
   - `OWNER_USERS` — the JSON array of hashed owner accounts
   - `DEMO_MODE` — leave unset, or set `false`
   - `CACHE_TTL_SECONDS` — optional, `180`
3. Deploy. Open the production URL, log in, and confirm the header says **Live HubSpot** and the yellow demo banner is gone.
4. Do not set `DEMO_MODE=true` on a project that also has a live token unless you explicitly want the fake book. Demo mode never calls HubSpot, but it will hide live data.

The repo is public. Do not commit `.env`, `.env.local`, or `data/users.json`.

## Security

- Read-only HubSpot client. `GET` and a short allow-list of search/batch-read `POST`s. `PATCH`, `PUT`, `DELETE`, and create endpoints are rejected before the request is sent.
- No token is sent to the browser. Record links point at HubSpot; the token stays on the server.
- Login failures are rate-limited per IP and email (in memory, per instance).
- Pages send `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`.
- Deal ids that are not in the venue filter 404, including FiDi records.
