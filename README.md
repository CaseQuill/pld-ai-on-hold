# PDL Dialer

Landing page for the Pond Lehocky BPO team to initiate ElevenLabs SSA hold calls.

## Stack

- Next.js 15 (App Router) on Vercel
- Upstash Redis (via Vercel KV integration) for rate limiting + round-robin state
- libphonenumber-js for phone validation

## What it does

1. Single input field: phone number (any US/CA format)
2. "Initiate call" button fires a POST to `/api/call`
3. Server validates + normalizes to E.164, enforces rate limits, picks the next SIP trunk phone number in round-robin, and hits ElevenLabs' outbound-call API
4. Toast on success/error

## Rate limits

- **10 per minute per IP** (sliding window)
- **100 per day global** (fixed window)

Tune in `lib/ratelimit.ts`.

## Configuration

Copy `.env.example` to `.env.local` and fill in:

| Var | Purpose |
| --- | --- |
| `ELEVENLABS_API_KEY` | EL API key |
| `EL_AGENT_ID` | SSA hold bot agent ID |
| `EL_PHNUM_IDS` | Comma-separated SIP trunk `phnum_` IDs for round-robin |
| `EL_ENV_TAG` | Dynamic variable tag sent to EL (default `pdl`) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |

On Vercel, enabling the KV/Upstash integration populates the Upstash vars automatically.

## Local development

```bash
npm install
cp .env.example .env.local   # fill values
npm run dev
```

Open http://localhost:3000.

## Deployment

1. Push to GitHub
2. Import to Vercel
3. Add env vars (or attach Vercel KV)
4. Add custom domain (e.g., `pld.finchlegal.com`)

## Notes

- `env=pdl` is passed as a `dynamic_variable` on every call so the agent/downstream logs can identify PDL-sourced calls (mirrors the `environment=test` convention used in testing).
- The URL is the only secret — keep it out of public channels.
