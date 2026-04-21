# PDL Dialer

Landing page + dashboard for the Pond Lehocky BPO team to initiate ElevenLabs SSA hold calls and track their outcomes.

## Stack

- Next.js 16 (App Router) on Vercel
- Upstash Redis (via Vercel KV integration) for rate limiting + round-robin state
- Neon Postgres (via Vercel Postgres integration) for the call history / dashboard
- libphonenumber-js for phone validation

## What it does

### `/` — Dialer
1. Single input field: phone number (any US/CA format, auto-formatted as you type)
2. "Initiate call" button fires a POST to `/api/call`
3. Server validates + normalizes to E.164, enforces rate limits, picks the next SIP trunk phone number in round-robin, and hits ElevenLabs' outbound-call API
4. On success, persists a row to Postgres (`status='active'`) and shows a success toast

### `/dashboard` — Call history
- Server-renders the last 50 calls from Postgres on load
- Client polls `/api/calls` every 5 seconds
- Each row: time | number | status (Active / Transferred / Failed) | conversation ID (click to copy)

### `/api/webhook/el` — EL post-call webhook
- Receives EL's post-call transcription webhook
- Verifies HMAC signature against `EL_WEBHOOK_SECRET`
- Infers final status from transcript tool calls + features_usage + termination reason
- Updates the calls row: `status`, `ended_at`, `end_reason`

## Rate limits

- **10 per minute per IP** (sliding window)
- **100 per day global** (fixed window)

Tune in `lib/ratelimit.ts`.

## Configuration

Copy `.env.example` to `.env.local` and fill in:

| Var | Purpose |
| --- | --- |
| `ELEVENLABS_API_KEY` | EL API key (must have `convai_write` / Agents → Write permission) |
| `EL_AGENT_ID` | SSA hold bot agent ID |
| `EL_PHNUM_IDS` | Comma-separated SIP trunk `phnum_` IDs for round-robin |
| `EL_ENV_TAG` | Dynamic variable tag sent to EL (default `pdl`) |
| `EL_WEBHOOK_SECRET` | Shared secret for verifying EL's post-call webhook |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `DATABASE_URL` | Neon Postgres connection URL |

On Vercel, the KV/Postgres integrations populate their respective vars automatically.

## Database setup

Run the schema once against your Neon database:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Or paste the contents of `db/schema.sql` into the Neon SQL console.

## EL webhook setup

In the ElevenLabs dashboard → Webhooks:

1. Create a new post-call webhook pointing to `https://<your-domain>/api/webhook/el`
2. Copy the signing secret EL generates and set it as `EL_WEBHOOK_SECRET` on Vercel

The webhook updates call statuses from `active` → `transferred` or `failed` when each call ends.

## Local development

```bash
npm install
cp .env.example .env.local   # fill values
npm run dev
```

Open http://localhost:3000 for the dialer, http://localhost:3000/dashboard for the call history.

Redis and Postgres are optional locally — rate limiting falls back to in-memory counters, and the dashboard will show "Dashboard unavailable" without `DATABASE_URL`.

## Deployment

1. Push to GitHub
2. Import to Vercel
3. Attach Upstash KV + Vercel Postgres / Neon from the Storage tab
4. Add remaining env vars
5. Run `db/schema.sql` against the Neon database (once)
6. Configure the EL post-call webhook
7. Add custom domain (e.g., `pld.finchlegal.com`)

## Notes

- `env=pdl` is passed as a `dynamic_variable` on every call so the agent/downstream logs can identify PDL-sourced calls (mirrors the `environment=test` convention used in testing).
- The URL is the only secret — keep it out of public channels.
- EL's `features_usage.transfer_to_number.used` field has historically been unreliable; the webhook also checks transcript tool calls and termination reason. Worth revisiting once real webhook payloads are observed.
