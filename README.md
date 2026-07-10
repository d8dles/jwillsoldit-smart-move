# JWillSoldIt Smart Move

Smart Move intake site for Joey Williams — JWillSoldIt / Christin Rachelle Group.

Live: https://move.jwillsoldit.com

---

## How it works

- `index.html` — the full Smart Move form (single-file, no build step)
- `api/smart-move.js` — Vercel serverless function that creates/updates a HubSpot contact and attaches the Smart Move Brief as a note
- `CNAME` — points `move.jwillsoldit.com` to this deployment

The form posts to `/api/smart-move`, which requires the Vercel runtime. Vercel serves the HTML and handles the backend from the same domain.

---

## Deploy to Vercel

1. **Import the repo**
   Go to https://vercel.com/new → Import Git Repository → select `d8dles/jwillsoldit-smart-move`

2. **Set environment variables**
   In the Vercel dashboard → Project → Settings → Environment Variables, add:

   | Key | Value |
   |-----|-------|
   | `HUBSPOT_ACCESS_TOKEN` | Your HubSpot private app access token |
   | `ALLOWED_ORIGIN` | `https://move.jwillsoldit.com` |

   To create a HubSpot token: HubSpot → Settings → Integrations → Private Apps → Create a private app.
   Required scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.schemas.contacts.read`, `crm.schemas.contacts.write`

   **Optional — instant lead alert email (via [Resend](https://resend.com)):**

   | Key | Value |
   |-----|-------|
   | `RESEND_API_KEY` | Your Resend API key |
   | `LEAD_ALERT_TO` | Email to notify on each new Smart Move submission. Use your current working email first (e.g. `jwillsoldit@icloud.com`), then switch to `leads@jwillsoldit.com` once Cloudflare Email Routing is verified. |
   | `LEAD_ALERT_FROM` | `Smart Move Leads <onboarding@resend.dev>` for initial testing. Switch to `Smart Move Leads <leads@jwillsoldit.com>` once your sending domain is verified in Resend. |

   All three vars must be set for alerts to send. If any are missing, alerts are silently skipped and a warning is logged. HubSpot sync is unaffected by alert failures.

3. **Deploy**
   Click Deploy. Vercel builds and deploys automatically on every push to `main`.

4. **Point the domain to Vercel**
   In Vercel → Project → Settings → Domains, add `move.jwillsoldit.com`.
   Update your DNS CNAME record at your registrar:

   | Type | Host | Value |
   |------|------|-------|
   | CNAME | move | `cname.vercel-dns.com` |

   This replaces the GitHub Pages CNAME target. The `CNAME` file in the repo root is not needed for Vercel but can stay.

5. **Verify**
   Open `https://move.jwillsoldit.com`, complete a test submission, and confirm the contact and note appear in HubSpot CRM.

---

## Local development

```bash
npm install -g vercel
vercel dev
```

Copy `.env.example` to `.env.local` and fill in your values:

```
HUBSPOT_ACCESS_TOKEN=your_token_here
ALLOWED_ORIGIN=http://localhost:3000

# Optional — omit to skip lead alerts locally
RESEND_API_KEY=your_resend_api_key
LEAD_ALERT_TO=your_email@example.com
LEAD_ALERT_FROM=Smart Move Leads <onboarding@resend.dev>
```

Then open http://localhost:3000.

---

## Rental Verification & Invoicing module (private)

A second, self-contained module lives alongside the public Smart Move funnel:
private tools for Joey to verify rental placements and prepare locator
commission invoices. It does not touch the Smart Move flow, its payloads, or
its HubSpot fields.

- **`/admin/verifications`** — list every verification file
- **`/admin/verifications/new`** — start a new file
- **`/admin/verifications/:id`** — file detail: generate/copy client + PM
  links, view submissions, compare mismatches, mark manually verified,
  prepare an invoice
- **`/admin/invoices/:id`** — invoice-ready fields (CRG locator invoice
  template), approve → send → mark paid, export JSON
- **`/forms/client-verification/:token`** and
  **`/forms/property-verification/:token`** — the tokenized public forms
  those links point to

**Required env vars** (see `.env.example`):

| Key | Purpose |
|-----|---------|
| `ADMIN_PASSWORD` | Shared password for `/admin` sign-in |
| `ADMIN_2FA_EMAIL` | Strongly recommended; enables two-factor sign-in. When set, a correct password also emails a 6-digit code (via Resend) to this address, and the code must be entered to finish signing in. Requires `RESEND_API_KEY` + `LEAD_ALERT_FROM`; if the code email can't be sent, sign-in fails closed. Leave unset for password-only (local dev). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Preferred production store for verification files, links, invoices, admin sessions, and login throttling. Uses the private `smart_move_store` table in Supabase Postgres. The service-role key must stay server-side in Vercel env vars. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Legacy/alternate production store. Used only if Supabase env vars are not set. |
| `TOKEN_ENCRYPTION_KEY` | Optional but recommended; encrypts link tokens at rest. Falls back to deriving a key from `ADMIN_PASSWORD` if unset. |

Sign-in is also throttled: five wrong passwords within 15 minutes locks
sign-in for 15 minutes, and each emailed code expires after 10 minutes with
at most five attempts.

Invoice emailing reuses the existing Resend integration (`RESEND_API_KEY` /
`LEAD_ALERT_FROM`) — nothing is ever sent automatically; email only fires
when Joey clicks "Send" on an already-approved invoice, and only if Resend
is configured and a recipient email is on file. Otherwise the invoice is
still marked sent for manual delivery.

Code lives under `api/_lib/` (storage, auth, tokens, audit, invoice
builder), `api/admin/` + `api/forms/` (endpoints), `admin/` + `forms/`
(pages), and `assets/css/admin.css` + `assets/js/admin-*.js` /
`assets/js/public-form-*.js` (front end) — all separate from the Smart Move
funnel's files.
