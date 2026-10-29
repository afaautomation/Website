# Deploying Kompetenzen: Cloudflare Pages + Google Cloud Run

```
Visitor ──► Cloudflare (kompetenzen.in)
              ├─ website pages, images, CSS, JS ............ Cloudflare Pages (static, global CDN)
              ├─ /Resume/*  (Resume Builder pages) ─┐
              └─ /api/*     (Resume Builder API)  ──┴──► Google Cloud Run, Mumbai (Resume/backend)
Database, login, file storage ......................... Supabase
```

Everything is served from **kompetenzen.in**, so a visitor who signs in on the website is also signed in to the Resume Builder. Cloudflare forwards `/Resume/*` and `/api/*` to Cloud Run with a shared secret (`PROXY_SECRET`); Cloud Run refuses every other caller.

Do part 1 first, because part 2 needs the Cloud Run URL.

---

## 1. Resume Builder backend → Google Cloud Run

Run these from the `Resume/` folder (its own git repo), with the [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and signed in.

### 1.1 One-time project setup
```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

### 1.2 Store secrets (never put them in the image or in git)
Create each secret once; paste the value when prompted, then press Ctrl+D (Ctrl+Z, Enter on Windows).
```bash
gcloud secrets create supabase-service-role-key --data-file=-
gcloud secrets create gemini-api-keys --data-file=-
gcloud secrets create xai-api-key --data-file=-
gcloud secrets create openrouter-api-key --data-file=-
gcloud secrets create resume-proxy-secret --data-file=-   # a long random value, see below
```
Generate the proxy secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it; Cloudflare needs the same value in step 2.3.

Let Cloud Run read them:
```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
for s in supabase-service-role-key gemini-api-keys xai-api-key openrouter-api-key resume-proxy-secret; do
  gcloud secrets add-iam-policy-binding $s --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
done
```

### 1.3 Deploy
```bash
gcloud run deploy resume-api \
  --source . \
  --region asia-south1 \
  --memory 2Gi --cpu 1 \
  --min-instances 1 --max-instances 10 --concurrency 40 \
  --no-cpu-throttling \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,TRUST_PROXY=2,SUPABASE_URL=https://lmimmujaqznybtcinwdo.supabase.co \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,GEMINI_API_KEYS=gemini-api-keys:latest,XAI_API_KEY=xai-api-key:latest,OPENROUTER_API_KEY=openrouter-api-key:latest,PROXY_SECRET=resume-proxy-secret:latest
```
Why these settings:
| Setting | Reason |
|---|---|
| `asia-south1` | Mumbai, closest to users in Kerala |
| `--min-instances 1` | No cold-start delay for the first visitor |
| `--no-cpu-throttling` | Resume imports finish **after** the upload request returns; with throttling they would freeze |
| `--memory 2Gi` | OCR and document parsing are memory-heavy |
| `--max-instances 10` | Caps cost during spikes or abuse |
| `--allow-unauthenticated` + `PROXY_SECRET` | Cloudflare must reach the service; the secret header stops anyone else |
| `TRUST_PROXY=2` | Takes the visitor's real IP through Cloudflare + Google, so rate limits work per visitor |

Do **not** set the `WHATSAPP_*` variables: the website and builder do not use the backend's OTP endpoints.

Copy the **Service URL** printed at the end (e.g. `https://resume-api-xxxxx-el.a.run.app`).
Check it: opening `<Service URL>/health` should work; `<Service URL>/api/templates` should return **403** (only Cloudflare may call it).

### 1.4 Templates
Templates are no longer re-seeded on every container start. When template definitions change, run once from your computer:
```bash
cd Resume/backend && npm run seed
```

### 1.5 Later releases
Run the same `gcloud run deploy` command. Each deploy is a new revision; roll back in Cloud Run → Revisions → Manage traffic.

---

## 2. Website → Cloudflare Pages

### 2.1 Connect the repository
Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → choose `afaautomation/Website`.

| Field | Value |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Build command | `node scripts/build-pages.cjs` |
| Build output directory | `dist` |

The build publishes only public files (pages, images, CSS, JS, config). The database schema, migrations, tests, dev server and the `Resume/` folder are never published. The `functions/` folder becomes the `/api` and `/Resume` forwarding automatically.

### 2.2 Custom domain
Pages project → **Custom domains** → add `kompetenzen.in` and `www.kompetenzen.in`. Moving the domain's nameservers to Cloudflare is recommended (Cloudflare shows the two nameservers to set at your registrar).

Then, for the domain:
- **SSL/TLS** → mode **Full (strict)**; **Edge Certificates** → **Always Use HTTPS** on.
- **Rules → Redirect Rules** → redirect `www.kompetenzen.in/*` to `https://kompetenzen.in/$1` (301).

### 2.3 Variables (Pages project → Settings → Variables and Secrets, Production)
| Name | Type | Value |
|---|---|---|
| `RESUME_BACKEND_URL` | Text | the Cloud Run Service URL from 1.3 |
| `RESUME_PROXY_SECRET` | **Secret** | the same value as `resume-proxy-secret` |

Redeploy after adding them (Deployments → latest → Retry deployment).

### 2.4 Cloudflare Pro protection (recommended)
- **Security → WAF** → turn on the Cloudflare Managed Ruleset.
- **Security → Bots** → Bot Fight Mode on.
- **Security → WAF → Rate limiting rules** → e.g. path starts with `/api/`, 120 requests per minute per IP → Block for 1 minute.

---

## 3. Settings in other services

- **Supabase → Authentication → URL Configuration:** Site URL `https://kompetenzen.in`; add `https://kompetenzen.in/**` and `https://*.pages.dev/**` (preview links) to Redirect URLs.
- **Supabase:** upgrade to **Pro** (daily backups); set **custom SMTP** (Authentication → Emails) before turning on **Confirm email**.
- **Signup OTP:** codes go over WhatsApp (Meta Cloud API), not Firebase SMS. Run `migrations/20261024_whatsapp_otp.sql`, approve the `verification_code` authentication template and deploy the `whatsapp-otp` and `phone-signup` functions; see `PHONE_SIGNUP_SETUP.md`.

---

## 4. After the first deploy, check

- [ ] `https://kompetenzen.in` loads; `http://` redirects to `https://`.
- [ ] `https://kompetenzen.in/supabase_schema.sql` and `/server.js` return 404.
- [ ] Jobs list and a job detail page load.
- [ ] Sign up (SMS code arrives), confirm email, log in, apply to a job; the application shows in the admin console.
- [ ] `https://kompetenzen.in/Resume/` opens the Resume Builder already signed in; templates load; export a PDF.
- [ ] Cloud Run → Logs show requests with visitors' IPs, and no errors.

## Local development (unchanged)
- Website: `node server.js` → http://localhost:3000
- Resume backend: `cd Resume/backend && npm run dev` → http://localhost:5000 (the builder at localhost uses it automatically)
- Tests: `node --test tests/admin-workflows.test.cjs tests/deploy.test.cjs` and `cd Resume/backend && npm test`
