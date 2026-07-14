# The Command Center

Personal command center for Joey Williams. One screen, opened at 8 AM daily.
Ventures in tiers, the Daily Three, client check-in cadence, deadlines, a money
snapshot, and a zero-friction capture inbox. Single user by design.

Built per the spec in this folder's originating CLAUDE.md build doc. Phase 1 is
implemented (auth, schema, one screen, capture endpoint). Phases 2 and 3
(/api/brief, /api/triage, /api/friday, trends) come later.

## Stack

- Next.js (App Router), deployed on Vercel, root directory `command-center/`
- Supabase project `command-center` (`gsxkavelomibgjihukne`, us-east-2):
  Postgres + RLS + email/password auth
- Phase 2 will add the Anthropic API, called from Next.js API routes only

## One-time setup

### 1. Create the account

Supabase Dashboard > project `command-center` > Authentication > Users >
"Add user". Use your real email, set a strong password, check "Auto confirm
user". No signup flow exists in the app on purpose. Creating the user
auto-seeds the venture tiers (Engine: Real Estate, Side Job. Build: The Pass,
WGU / CompTIA A+. Backlog: Bunz LLC, Grove Terminal, Content as a Business).

### 2. Create the Vercel project

1. Vercel > Add New Project > import this GitHub repo.
2. Set **Root Directory** to `command-center`. Framework preset: Next.js.
3. Add the environment variables below, then deploy.

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gsxkavelomibgjihukne.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API > publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > service_role (server-only, used by /api/capture) |
| `CAPTURE_TOKEN` | Generate: `openssl rand -hex 32`. The iPhone Shortcut sends this. |
| `CAPTURE_USER_ID` | Optional. Only needed if a second account ever exists. |
| `ANTHROPIC_API_KEY` | Phase 2. Create at console.anthropic.com when we build the brief. |

### 3. Install on the iPhone

Open the deployed URL in Safari > Share > "Add to Home Screen". It opens
full-screen (standalone PWA) with the Command Center icon.

## iPhone Shortcuts

### Shortcut A: open at 8 AM

1. Shortcuts app > Automation tab > "+" > Time of Day > 8:00 AM, Daily.
2. Turn ON "Run Immediately" (no confirmation).
3. Action: "Open URLs" with the app URL.

### Shortcut B: "Add to Command Center" (capture)

1. Shortcuts app > "+" new shortcut, name it **Add to Command Center**.
2. Add action **Ask for Input** (Text), prompt: "What's on your mind?"
   (For dictation, add **Dictate Text** instead and use its output.)
3. Add action **Get Contents of URL**:
   - URL: `https://YOUR-APP-URL/api/capture`
   - Method: `POST`
   - Headers: `Authorization` = `Bearer YOUR_CAPTURE_TOKEN`
   - Request Body: JSON, field `text` = the input variable
4. Optional: add to Home Screen, and say "Hey Siri, Add to Command Center".
5. Enable "Show in Share Sheet" (accepts text) so any selected text can be
   captured from anywhere.

The endpoint accepts `{ "text": "..." }` and inserts into the inbox. It
returns `{ "ok": true }` on success, 401 on a bad token.

### 8 AM Claude scheduled task

Configured in Claude (Cowork scheduled task), outside this codebase: a daily
8 AM prompt that asks for the Daily Three and links to the app URL.

## Development

```bash
cd command-center
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

Database schema lives in `supabase/migrations/` (already applied to the
`command-center` project via MCP). RLS is owner-only on every table. Two
triggers: new-user venture seeding, and completing a `client_followup` task
stamps `completed_at` and bumps the matching active client's `last_contact`.

## Build phases

- **Phase 1 (this):** auth, schema + RLS + seed, the one screen with manual
  entry everywhere, quick-add inbox, `/api/capture` + Shortcut docs.
- **Phase 2:** `/api/brief`, `/api/triage`, `/api/friday`; brief auto-runs on
  first open of the day.
- **Phase 3 (only after 2 weeks of daily use):** completion trends, monthly
  review. Nothing else. Mid-build ideas go to `PARKING-LOT.md`, not into code.
