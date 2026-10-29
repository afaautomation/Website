# Moving www.kompetenzen.in to Cloudflare

The domain `kompetenzen.in` is registered at **Hostinger** and currently shows the old website. The new website runs on **Cloudflare Pages** at `kompetenzen.pages.dev`. This guide moves the domain's DNS to Cloudflare ahead of time, sets up `hr@kompetenzen.in` with Cloudflare Email Routing, and switches the domain to the new website on the day of the launch event.

**The domain stays registered at Hostinger.** Only its DNS (the address book that says which server answers) moves to Cloudflare.

| When | What | Visitors see |
|---|---|---|
| **Phase 1**: 3+ days before | Move DNS to Cloudflare, set up email | Old website |
| **Phase 2**: 1–2 days before | Rehearse, prepare every setting | Old website |
| **Phase 3**: launch day, 30–45 min before the announcement | Switch the domain to the new website | New website |
| **Phase 4**: after the event | Tidy up and tune | New website |

---

## Phase 1: Move DNS to Cloudflare (3 or more days before)

### 1.1 Record what exists in Hostinger

1. **hpanel.hostinger.com → Domains → kompetenzen.in → DNS / Nameservers → DNS records.**
2. Take screenshots of **every** record. Note in particular the records for `@` and `www`; they are needed to roll back.
3. If **DNSSEC** is on (Domains → kompetenzen.in → **DNSSEC**), turn it **off**. Leaving it on breaks the domain after the nameserver change.
4. Optional: back up the old website (Websites → **File Manager** → download).

### 1.2 Add the domain to Cloudflare

1. **dash.cloudflare.com → Add → Connect a domain.**
2. Enter `kompetenzen.in`, choose **Quick scan for DNS records**, and click **Continue**.
3. Choose the **Free** plan.

### 1.3 Review the copied DNS records

1. Compare the list with your Hostinger screenshots and add anything missing.
2. **Keep** the records for `kompetenzen.in` (`@`) and `www`. They still point to the old website, so visitors notice nothing.
3. Edit those two records and set **TTL** to the lowest value offered (1 min, otherwise **Auto**). This makes the switch on launch day spread quickly.
4. Delete any old **MX** records only if you have no mailbox at Hostinger. Email Routing (1.6) adds its own.
5. Click **Continue**. Cloudflare shows **two nameservers** (for example `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`). Copy them.

### 1.4 Point Hostinger at Cloudflare

1. **Hostinger → Domains → kompetenzen.in → DNS / Nameservers → Change nameservers.**
2. Choose **Use custom nameservers**, enter the two Cloudflare nameservers, and save.
3. Back in Cloudflare, click **Check nameservers now**.

### 1.5 Wait for activation

Cloudflare emails **"kompetenzen.in is now active on a Cloudflare Free plan"**, usually within a few hours (up to 24). Until then, change nothing else. Open `https://www.kompetenzen.in`: it should still show the old website.

### 1.6 Set up email: Cloudflare Email Routing

Email Routing forwards mail sent to `hr@kompetenzen.in` to an existing inbox (for example the HR team's Gmail). It is free and does not affect the website.

1. **dash.cloudflare.com → kompetenzen.in → Email → Email Routing → Get started.**
2. **Create address:**
   - Custom address: `hr`
   - Action: **Send to an email**
   - Destination: the Gmail inbox that should receive the mail
3. Open the verification email Cloudflare sends to that Gmail and click **Verify email address**.
4. When Cloudflare asks to add its DNS records (**MX** and **SPF TXT**), click **Add records and enable**. If it offers to remove old MX records, allow it.
5. Optional: **Routing rules → Catch-all address → Send to an email**, so any address at kompetenzen.in (`info@`, `admin@`) reaches the same inbox.
6. **Test:** from a different email account, send a message to `hr@kompetenzen.in`. It should arrive in the Gmail within a minute (check Spam the first time).

### 1.7 Optional: reply as hr@kompetenzen.in from Gmail

Email Routing only receives. To reply from the same address:

1. Turn on 2-Step Verification for the Gmail account, then create an **app password** at **myaccount.google.com → Security → App passwords**.
2. **Gmail → Settings (gear) → See all settings → Accounts and Import → Send mail as → Add another email address.**
3. Name `Kompetenzen HR`, email `hr@kompetenzen.in`, untick **Treat as an alias** → **Next**.
4. SMTP server `smtp.gmail.com`, port **587**, username = the full Gmail address, password = the app password, **TLS** → **Add account**.
5. Gmail sends a confirmation code to `hr@kompetenzen.in`. It arrives in the same Gmail through Email Routing; enter it.
6. In Cloudflare **DNS → Records**, edit the SPF **TXT** record for `kompetenzen.in` so it allows both Cloudflare and Gmail:

   ```
   v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all
   ```

When replying, choose `hr@kompetenzen.in` in the **From** field. Some recipients may see "sent on behalf of"; Google Workspace removes that if it matters later.

---

## Phase 2: Rehearse and prepare (1–2 days before)

### 2.1 Rehearse with a test address

1. **Workers & Pages → kompetenzen → Custom domains → Set up a custom domain.**
2. Enter `test.kompetenzen.in` → **Continue** → **Activate domain**.
3. Wait until it shows **Active** and note how long it took. Open `https://test.kompetenzen.in`: it should show the new website.
4. Remove `test.kompetenzen.in` from **Custom domains** (and its CNAME from **DNS → Records**).

### 2.2 Add the new domain everywhere

Adding it early is harmless; the old address keeps working.

| Where | Add |
|---|---|
| **Supabase → Authentication → URL Configuration → Redirect URLs** | `https://www.kompetenzen.in/**` (do **not** change Site URL yet) |
| **Google Cloud Console → APIs & Services → Credentials → OAuth client → Authorized JavaScript origins** | `https://www.kompetenzen.in` |
| **Meta developer app → App settings → Basic → App domains** | `kompetenzen.in` |

### 2.3 Prepare the root-to-www redirect

1. **kompetenzen.in → Rules → Redirect Rules → Create rule.**
2. Name: `Root to www`.
3. **If incoming requests match:** Custom filter expression, **Hostname** equals `kompetenzen.in`.
4. **Then:** Type **Dynamic**, expression:

   ```
   concat("https://www.kompetenzen.in", http.request.uri.path)
   ```

   Status code **301**, tick **Preserve query string**.
5. Click **Save as Draft** (not Deploy). It is turned on at launch.

### 2.4 Publish and test the final website

Publish the final version to Cloudflare Pages and test it on `https://kompetenzen.pages.dev`: homepage, sign up with WhatsApp OTP, sign in, staff login, job application, consultation booking, privacy page.

---

## Phase 3: Launch day (start 30–45 minutes before the announcement)

1. **DNS → Records:** delete the old `@` and `www` records (the ones pointing to Hostinger). Keep the MX and TXT email records.
2. **Workers & Pages → kompetenzen → Custom domains → Set up a custom domain:**
   - `www.kompetenzen.in` → **Activate domain**
   - `kompetenzen.in` → **Activate domain**

   Wait until both show **Active** (usually 2–15 minutes; compare with the rehearsal).
3. **Rules → Redirect Rules:** deploy **Root to www**.
4. **Supabase:**
   - **Authentication → URL Configuration → Site URL:** `https://www.kompetenzen.in` → Save.
   - In PowerShell:

     ```powershell
     npx supabase secrets set --project-ref lmimmujaqznybtcinwdo 'SITE_URL=https://www.kompetenzen.in'
     ```
5. **Meta → App settings → Basic:** Privacy policy URL and Data deletion instructions URL → `https://www.kompetenzen.in/privacy` → Save.
6. **Test on a phone using mobile data** (office Wi-Fi may still remember the old site):
   - [ ] `https://www.kompetenzen.in` shows the new homepage with the padlock
   - [ ] `kompetenzen.in` jumps to `https://www.kompetenzen.in`
   - [ ] Sign in (WhatsApp OTP and Google)
   - [ ] Consultation booking form saves
   - [ ] `https://www.kompetenzen.in/privacy` opens
7. Announce.

### Rollback

If something goes wrong and cannot be fixed quickly:

1. **Custom domains:** remove `www.kompetenzen.in` and `kompetenzen.in`.
2. **DNS → Records:** re-add the old `@` and `www` records from the screenshot (step 1.1).
3. **Redirect Rules:** turn off **Root to www**.

The old website returns within minutes. Email keeps working throughout.

---

## Phase 4: After the event

### 4.1 Recommended Cloudflare settings

| Where | Setting |
|---|---|
| SSL/TLS → Overview | **Full (strict)** |
| SSL/TLS → Edge Certificates | **Always Use HTTPS**: on · **Minimum TLS version**: 1.2 |
| Speed → Optimization | **HTTP/3**, **Early Hints**: on |
| Speed → Optimization | **Rocket Loader**: **off** (it breaks the page scripts) |
| Security → Bots | **Bot Fight Mode**: on |

### 4.2 Search engines

1. Hide the `kompetenzen.pages.dev` copy from Google so only `www.kompetenzen.in` appears in search (a `_headers` rule; ask for it to be added and publish).
2. **Google Search Console** (search.google.com/search-console) → **Add property** → **Domain** `kompetenzen.in` → verify with the TXT record it gives you (add it in Cloudflare **DNS → Records**).

### 4.3 Hostinger

- **Keep** the domain registration at Hostinger with **auto-renew on**. If it expires, the website and email stop.
- After a week of everything working, cancel the old **hosting plan** if nothing else uses it.
- Keep the nameservers pointing to Cloudflare.
