# CallAgent

AI-powered phone investigation assistant that calls contacts, investigates requirements, streams live progress/transcripts, and recommends the best option with action items.

## Tech Stack

- Next.js 16 App Router + shadcn/ui
- Next.js API routes (Node runtime)
- SSE for live updates
- LiveKit SIP outbound calls (Twilio SIP trunk setup expected)
- Google Gemini Live API + structured extraction
- PostgreSQL (Docker) + Prisma

## Local Setup

1) Install dependencies

```bash
npm install
```

2) Configure environment variables

```bash
cp .env.example .env
```

Fill all required telephony and AI keys in `.env`:
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_AGENT_NAME` (agent worker dispatch target)
- `LIVEKIT_SIP_TRUNK_ID`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SIP_TRUNK_SID`
- `GEMINI_API_KEY`
- `GEMINI_REALTIME_MODEL` (defaults to native audio realtime model)
- `GEMINI_REALTIME_VOICE`
- `CALL_SESSION_TIMEOUT_SECONDS`
- `CALLAGENT_LOG_LEVEL` (optional: `debug`, `info`, `warn`, `error`; default `info`)

3) Start Postgres and migrate

```bash
npm run db:up
npm run db:migrate
npm run db:generate
```

4) Run the app + voice agent worker

```bash
npm run dev:all
```

Open `http://localhost:3000`.

## Product Flow

1. Screen 1: Enter requirement + contacts
2. Screen 2: Watch live call progress and transcript stream
3. Screen 3: View ranked recommendations + action items

## Scripts

- `npm run dev` - start development server
- `npm run dev:agent` - start LiveKit telephony agent worker
- `npm run dev:all` - run app + agent worker together
- `npm run lint` - lint checks
- `npm run test` - run tests
- `npm run build` - production build validation
- `npm run db:up` / `npm run db:down` - start/stop local Postgres
- `npm run db:migrate` - run Prisma migration
- `npm run db:generate` - generate Prisma client

## API Endpoints

- `POST /api/investigations` - create investigation with contacts
- `POST /api/investigations/:id/start` - start orchestration
- `GET /api/investigations/:id/events` - SSE live stream
- `GET /api/investigations/:id/results` - final ranked output

## Notes

- Calls run with max concurrency of 3.
- Retry with exponential backoff is enabled for transient call/session failures.
- Telephony voice path requires the LiveKit agent worker to be running (`npm run dev:agent` or `npm run dev:all`).
- Secure trunking (TLS + SRTP) must be enabled between Twilio and LiveKit for stable audio.
