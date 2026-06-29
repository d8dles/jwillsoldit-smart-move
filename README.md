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
   Required scopes: `crm.objects.contacts.write`, `crm.objects.contacts.read`, `crm.objects.notes.write`.

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

Copy `.env.example` to `.env.local` and fill in your token:

```
HUBSPOT_ACCESS_TOKEN=your_token_here
ALLOWED_ORIGIN=http://localhost:3000
```

Then open http://localhost:3000.
