# Kompetenzen pre-production audit

**Decision: NO-GO for production launch.**

Audit completed 1 November 2026 (Asia/Calcutta), beginning 31 October. This is a technical readiness and compliance-gap assessment, not a penetration-test certification, legal opinion, or assurance of Google rankings.

## A. Executive summary

The local application is substantially better protected after this audit, but production readiness is not established. Two reproducible high-severity application defects were corrected: the résumé proxy could forward its credential to a host supplied through the URL path, and temporary résumé uploads could be downloaded without an account. The backend dependency update removed all five high-severity entries reported by the registry. Additional corrections cover caching, controlled upstream failures, private-file cleanup, production configuration, bounded template caching, missing-page handling, metadata, labels, and account-dialog keyboard behavior.

**Verification:** the website suite passes **107/107 tests**; the résumé backend passes **126/126 tests across 14 suites**. The final website build succeeds. The proxy regression suite also passed after the final timeout adjustment. All classic inline scripts in the website HTML parse successfully. The build contains 159 files, totaling **50,104,617 bytes**. These are local results, not a production load test.

**Strengths:** explicit invitation/allowlist checks for staff; verified Supabase tokens at backend boundaries; owner filtering for private résumé operations; private Supabase résumé storage with a 5 MiB limit; hashed signup OTPs with expiry and guess limits; notification consent and queue tests; pinned AI assets and an output allowlist; meaningful existing regression tests, including isolated PostgreSQL migration exercises.

**Launch blockers:** fixes are not deployed; the custom domain still serves the old website; there is no authorized isolated staging database or pair of live role-test accounts; backup restoration and rollback have not been demonstrated; durable recovery of interrupted résumé imports is missing; mobile/desktop browser, performance, and accessibility acceptance remain unverified; privacy/retention/minor-user obligations need owner and legal decisions. Ten moderate runtime dependency entries remain for reachability review/remediation.

The supplied Supabase project was explicitly confirmed by the owner to be the **shared live database, read-only for this task**. No production records, accounts, policies, migrations, infrastructure, credentials, payments, or messaging settings were changed. No email or WhatsApp message was sent. Changes exist in **two independent repositories**: the website and its ignored nested `Resume/` checkout. Both must be reviewed and released.

## Scope, evidence, and limitations

Website baseline commit: `8911de3590e84f0013a09d5d065cf3b9981e290f`.
Résumé baseline commit: `4173bd460a9bd21300ce10d4ac96331bbf62a8e5`.
The audit changes are uncommitted local edits on top of those commits.

The inventory scanned 179 tracked text/source files across both repositories, plus the website pages and generated assets. Architecture and security review concentrated on authentication, authorization, SQL policies/functions, file uploads, proxying, notifications, rendering, data flows, and deployment. This does not mean every execution path has been exercised or every historical blob has been exhaustively reviewed.

Evidence is in `output/preproduction-audit/`:

- `source-baseline.json`, `source-final.json`: page metadata, links/resources, endpoint and environment-name inventories, package versions, asset sizes, and source checks.
- `live-readonly.json`: actual public HTTP results, anonymous HEAD-only data checks, public auth settings, and storage-bucket configuration. It contains no user records or secret values.
- `audit-live-schema.json`: live table/column and RPC names retrieved using the existing authorized configuration; no row data.
- `audit-npm-root.json`, `audit-npm-backend.json`, `audit-npm-backend-after.json`, `audit-npm-backend-runtime.json`: registry findings before/after.
- `verification-summary.json`: test/build outcomes and limitations.

Raw local test diagnostics remain under `tmp/audit-*.log`. Synthetic test fixtures are not production users. SQL tests use PGlite; backend route tests use a fake Supabase boundary. Earlier commentary summarized these as mocks; the SQL suites also execute real migration SQL in an isolated PostgreSQL engine. Neither approach substitutes for live Supabase role tests.

Browser verification was attempted through the available UI tools: creating the local in-app browser timed out and reset its session; the Chrome fallback could not expose the window accessibility state. Consequently no browser screenshots, viewport results, Lighthouse scores, field Core Web Vitals, contrast measurements, or screen-reader certification are claimed.

## Architecture and critical workflows

| Layer | Implementation | Trust/data boundary |
|---|---|---|
| Public website | 24 original HTML pages, inline scripts/styles, shared vanilla JS/CSS; one new 404 page | Browser calls Supabase directly using a public publishable key; SQL RLS/RPC permissions are authoritative |
| Staff consoles | `admin.html`, `marketing.html`, `js/staff-gate.js`; password setup page | Verified email plus protected staff allowlist through `is_admin`; hiding the UI is not the authorization boundary |
| Main database | Supabase PostgreSQL, Auth, Storage | 24 tables exposed in service-role schema metadata; candidate/application data, staff, content, consent, queues, OTP/rate records |
| Main functions | Five Supabase Edge Functions using Deno | Public OTP/signup; signed SMS hook; signed WhatsApp callback; secret-authenticated notification worker |
| Résumé gateway | Cloudflare Pages `/api/*` and `/Resume/*` functions | Adds an origin proxy secret; passes the user bearer token; strips spoofed forwarding headers and cookies |
| Résumé backend | Express 4.22.1, Supabase JS 2.116.0, Helmet, rate limits; Node 22 Docker image | Service-role database access bypasses RLS, so each controller must enforce ownership |
| Résumé processing | Multer uploads, Mammoth DOCX extraction, Tesseract OCR, Handlebars HTML, browser PDF workflow | Private files and user content; external AI providers for writing/scan features |
| Staff matching | SQL rules plus browser-side Transformers 4.3.1, quantized MiniLM and WASM | Local model inference; SQL remains responsible for eligibility and stored matching results |
| Delivery | Gmail or Resend; Meta WhatsApp | Consent preferences → queue → claim → provider → delivery callback; secrets belong in server configuration |
| Hosting | Cloudflare Pages + Google Cloud Run + Supabase | Two repos and separately deployed Edge Functions/migrations; main-domain cutover is still pending |

Primary journeys: public course discovery → enquiry/enrolment; WhatsApp signup/login → candidate/internship profile → résumé attachment → job requirements → application; staff invitation/login → job management → matching/review → notifications; résumé creation/edit/history/restore/import/AI/preview/export; marketing edits → published course/showcase content; notification opt-in/opt-out and privacy requests.

The main database relationships include `auth.users` → `profiles`, `candidate_profiles`, `resumes`, `import_jobs`, and notification preferences; `resumes` → versions and optional templates; jobs → applications and matching snapshots. The source includes cascading deletes for core owner-linked résumé tables. Full live FK/index/policy definitions, row counts, deletion propagation, query plans, database network controls, pool configuration, encryption-at-rest settings and backup policies were not obtained from the REST schema document.

### Endpoint inventory

| Surface | Endpoints / operations | Expected access |
|---|---|---|
| Website | `/`, school/course pages, `/jobs`, `/internships`, `/job-details?id=…`, placements/story/privacy, talent hunt | Public content; job details are populated by JavaScript |
| Candidate | `/create-profile`, `/internship-profile`, `/enroll` | Profile writes require an account; public enrolment is validated by SQL |
| Staff | `/admin`, `/marketing`, `/admin-password` | Staff data gated by database authorization; setup/recovery needs a valid Auth flow |
| Supabase functions | `/functions/v1/whatsapp-otp`, `phone-signup` | Public, validated body; service-only OTP functions and rate checks |
| Supabase functions | `send-sms-hook`, `notification-whatsapp-inbound` | Hook signature / Meta signature; verification challenge for webhook GET |
| Supabase functions | `notification-worker` | POST with worker secret; configured HTTPS site URL |
| Supabase public RPCs | `is_admin`, `job_details`, `apply_to_job`, `save_notification_preferences` | Public or current-user scope according to each function |
| Supabase staff RPCs | `admin_jobs`, `replace_reels`, `admin_matched_applicants`, `admin_matching_overview` | Staff check inside the function |
| Résumé authentication | `GET/PATCH /api/auth/me`; `POST /api/auth/send-otp`, `/verify-otp`; `/staff-signup` returns 410 | Account routes authenticated; legacy OTP routes separate from the website login flow |
| Résumés | `GET/POST /api/resumes`; `GET/PUT/PATCH/DELETE /api/resumes/:id`; duplicate, ATS, design, order, versions, restore | Authenticated owner; deliberate public sharing is a read exception |
| Templates/tips | `/api/templates`, `/categories`, `/:id`; `/api/tips`, `/:section`, `/:section/random` | Metadata/tips public; single-template route authenticated |
| Import | `POST /api/import`, `GET /api/import/jobs/:id` | Authenticated; owner-filtered job status |
| Export | `GET /api/export/:resumeId/preview`; `POST /preview`, `/download` | Saved records require identity/ownership; stateless rendering of caller-supplied content intentionally public |
| AI | `POST /api/ai/scan`, `/translate`, `/suggest` | Verified identity and per-user limits |
| Operations | `/health`, `/api`, frontend static assets | Proxy-gated origin except health; health failure now generic 503 |

Full route-method entries, environment variable **names only**, table/RPC usage, and locked direct dependency versions are included in `source-final.json`. No payment gateway was found. Payment/refund execution tests are not applicable to the available implementation; commercial course terms still need review.

## B. Detailed findings

“Fixed locally” means source correction and the specified local verification; it never means the live deployment has been corrected. Severity is assessed for this application, not copied mechanically from a dependency score.

| ID | Category | Severity | Location | Issue | Evidence | Root cause | Fix | Verification | Status |
|---|---|---|---|---|---|---|---|---|---|
| A01 | Security | High | `functions/api/[[path]].js`, Resume proxy | Proxy credential could be sent to an attacker-selected origin | Synthetic `/Resume//attacker.invalid/collect` request made the old mocked fetch target external; regression failed before fix | Resolving an untrusted path with `new URL(path, base)` accepts a protocol-relative host | Assign pathname/search on a validated HTTPS backend URL | Passed synthetic external-path regression; no real exfiltration performed | Fixed locally |
| A02 | Privacy/security | High | `Resume/backend/src/server.js` | Unauthenticated temporary résumé download | Synthetic file under `uploads/resumes` returned 200 without a user; now returns 404 | Whole upload directory was statically public | Deny resume/temp downloads; only avatar directory remains static | Passed HTTP regression | Fixed locally |
| A03 | Security | Medium | Backend API and Pages proxy | Private API/preview responses lacked explicit no-store | New cache regression failed against old response headers | API responses inherited no privacy cache directive; Pages `_headers` alone does not cover function responses | Set no-store and noindex in backend and proxy responses | Passed response-header tests | Fixed locally |
| A04 | Reliability | Medium | Pages proxy | Upstream fetch failures escaped the handler; no explicit deadline | Mock upstream rejection threw private diagnostic detail | No error mapping or deadline | Generic 502/504 and five-minute deadline, allowing existing 45-second AI fallback slots | Failure case passed; full deadline/stream interruption not timed end-to-end | Fixed locally; streaming soak untested |
| A05 | Deployment/security | Medium | Backend startup | Missing proxy secret silently disabled origin gate | `if (PROXY_SECRET)` guarded the middleware | Optional security-critical production setting | Production now refuses startup without it | Passed isolated production-start test | Fixed locally |
| A06 | Privacy/reliability | Medium | `importController.js` | File leaked on disk when import-job insert failed | Failure branch returned before extraction cleanup | Cleanup only attached to extraction promise | Delete upload on database insert failure | Passed injected-DB-failure regression | Fixed locally |
| A07 | Reliability | Medium | `exportController.js` | Unbounded template cache accepts unique public request keys | Map had TTL on reads but no eviction/size cap | Fallback template results cached under arbitrary IDs | Maximum 100 entries with oldest-entry eviction | Passed 102-key cache-eviction regression | Fixed locally |
| A08 | Supply chain | High | Backend lockfile | Five high-severity dependency entries | Registry baseline: body-parser, brace-expansion, browserslist, follow-redirects, js-yaml | Vulnerable resolved transitive versions | Compatible `npm audit fix --ignore-scripts`; 34 packages changed, no forced major upgrades | Reaudit: zero high/critical; backend suite passes | Fixed locally for high findings |
| A09 | Supply chain | Medium | Backend dependency graph | Remaining moderate runtime findings | Runtime audit: 10 entries; all-dependency audit: 29 entries (25 moderate, 4 low) | Legacy dependency chains, including archiver/minimatch and uuid consumers; qs advisory | Review reachability, remove proven unused production dependencies, make targeted upgrades; avoid audit-suggested major downgrades | Registry finding confirmed; exploitability not demonstrated | Open |
| A10 | Local security | Medium | `server.js` | Development server could serve private workspace JSON/tools | Root-directory serving did not exclude tmp/output/migration-backup/package files | Extension denylist was incomplete | Explicit private-directory/file exclusion; preserve loopback binding | Passed local HTTP deny tests | Fixed locally |
| A11 | Deployment/reliability | Medium | Backend `package.json` | `npm start` seeded templates before every start | Start script invoked seed; Docker start already avoided it | Two inconsistent startup paths | Start server only; seed remains an explicit release operation | Manifest reviewed; existing seeding behavior retained as separate command | Fixed locally |
| A12 | SEO/functionality | Medium | Missing `404.html` | Pages returns homepage with 200 for unknown routes and missing crawler files | Live nonexistent URL, robots and sitemap all returned the 178,804-byte homepage | Pages assumes SPA fallback when no top-level 404 exists | Added real 404 page and crawler files to build allowlist | Build/source and local 404 tests pass; live still old | Fixed locally; deployment pending |
| A13 | SEO | Medium | Public HTML, sitemap, robots | Most pages lacked canonicals; existing ones disagreed with deployment’s apex-host plan | Baseline 3 canonical links; no crawler files | Metadata not applied consistently | 17 canonical public URLs, aligned OG URLs, missing social metadata, sitemap and robots; private forms noindex | Sitemap/metadata tests pass | Fixed locally; host redirect pending |
| A14 | Accessibility/privacy | Medium | `js/auth-modal.js`, staff searches | Unassociated labels, pointer-only password toggle, absent dialog focus containment, no visible signup privacy link | Source review; new keyboard regression exercises original handler code | Dynamically injected UI not covered by static HTML-only checks | Labels, dialog semantics, keyboard button, Tab containment, initial/return focus, real privacy link; two staff search labels | Syntax/auth tests and keyboard unit test pass; visual/assistive-tech retest blocked | Fixed locally, partial verification |
| A15 | Security | Medium | `_headers`, inline website scripts | No CSP originally; current fix is only a baseline | Live Pages response lacks CSP; extensive inline JS/styles remain | No complete resource/script policy | Added object/base/frame/form restrictions; plan nonce/hash-based script policy with browser tests | Config reviewed; complete XSS-limiting CSP unverified | Partially fixed; open |
| A16 | Storage/abuse | High | Storage policies; profile/application uploads | Anonymous write-only application upload path has no per-user quota | Source grants anon INSERT to `resumes/applications/*`; frontend uses that namespace | Legacy public drop-box design; 5 MiB per-file cap does not cap number of files | Coordinate owner-scoped upload paths, RPC validation, legacy-object handling and quota enforcement in staging | Code-reviewed only; live writes not attempted | Open; coordinated migration required |
| A17 | Reliability | High | `importController.js` | Restart can strand an import in `processing` | Extraction runs in an unawaited in-process promise after response | No durable job worker/lease/restart recovery | Durable queue or resumable job worker; reconcile stale jobs; test termination during processing | Code-reviewed; restart test blocked | Open |
| A18 | Data integrity | Medium | `resumeController.js:saveVersion/updateResume`, schema | Concurrent save/history writes are not atomic | Reads max version, inserts history, then updates résumé via separate REST operations; no unique `(resume_id,version_num)` constraint in reviewed schema | Read-modify-write across requests | Transactional SQL RPC with row lock/version constraint or optimistic concurrency and conflict UI | Code-reviewed; concurrent live writes not attempted | Open |
| A19 | Deployment | High | `DEPLOY.md`, shared frontend config, live hosts | Custom domain serves old site; preview and intended production use the live database | Actual titles/body sizes differ; owner confirmed shared live project | Cutover pending; no isolated staging configuration supplied | Create isolated environment/test users, rehearse release, then authorized domain cutover | Read-only HTTP/config confirmation | Open |
| A20 | Privacy | High | Profile age inputs and `privacy.html` | Users aged 15–17 are accepted without implemented guardian verification | Both profiles allow 15–70; policy says 18+ or guardian agreement | Policy and age/consent implementation differ | Owner/counsel decide adult-only access or verified guardian flow; implement and test chosen policy | Code-reviewed; legal applicability/effective duties require counsel | Open |
| A21 | Privacy | Medium | Privacy retention statement, rate tables | “Deleted automatically within one hour” is not supported consistently | Rate cleanup happens on later submissions; phone OTP/IP cleanup uses one day | Activity-driven deletion and missing operational retention schedule | Define retention by category, schedule deletion, test rights/deletion/backups, align notice | Code-reviewed; production deletion not tested | Open |
| A22 | Legal/content | Medium | Signup choice markup, public pages | Approved service/fee/refund terms and rights evidence absent | Dormant choice screen has placeholder Terms link; no terms page in inventory; claims/photos need provenance | Missing approved commercial/legal content | Owner-approved terms/refund/cancellation disclosures as applicable; copyright/testimonial permission records | Document availability inspected; legal sufficiency not assessed | Open |
| A23 | Operations | High | Backups, monitoring, rollback | Recovery and alerting evidence unavailable | No restore exercise, RPO/RTO, deployed alert configuration or rollback rehearsal provided | Operational controls not demonstrated | Restore isolated backup; establish RPO/RTO, alerts, queue monitoring and release rollback | Not Tested | Blocked |
| A24 | Testing/CI | Medium | Both `.github/workflows/readiness.yml` | No tracked CI workflow in either baseline | Repository inventory | Checks depended on local execution | Added separate test/audit pipelines; website installs pinned isolated SQL runtime and builds | Local commands pass; hosted Actions run not performed | Prepared locally |

Additional risks requiring targeted validation: enquiry SQL uses count-then-insert rate checks without explicit serialization; trust in forwarded IP headers must match deployed gateways; upload MIME declarations are not file-content verification or decompression quotas; backend rate limits and legacy OTP state are process-local; DB/webhook requests do not all have explicit deadlines; template/source caching and client stored sessions increase the importance of XSS controls. These are **code-review risks**, not claimed successful exploits or load-test failures.

Secret checks found no matching private-key/GitHub-token/Google-key/secret-publishable-key patterns in current scanned source. The scoped history pattern scan matched only historical `firebase-config.js` commits in the website repo and no matches in the résumé repo. Firebase web configuration contains client API identifiers, which are not automatically private credentials; no compromised privileged credential is established by that match. Broad entropy scanning, complete historical JWT classification, cloud credential validity and provider restrictions remain unverified. No key values are included here.

## Functional and reliability test matrix

| Workflow / check | Status | Evidence and boundary |
|---|---|---|
| Website regression suite | Passed | 107 tests, no skips; Node test runner |
| Résumé backend suite | Passed | 126 tests, 14 Jest suites; offline database boundary |
| Isolated SQL matching/migration repeatability | Passed | Actual migration SQL in PGlite, matching/role checks; not full Supabase auth/storage integration |
| Isolated notification consent/queue/deduplication | Passed | PGlite plus provider mocks; no real deliveries |
| OTP expiry/guesses/cooldowns/provider-error handling | Passed | Isolated SQL and synthetic handler tests |
| Owner/other/anonymous résumé routes and history | Passed | Backend integration/security tests with synthetic users |
| DOCX import success, invalid input, cleanup failure branch | Passed | Local synthetic documents; fake job persistence; OCR result mocked |
| AI fallback/disconnection handling | Passed | Synthetic provider failures/streams; no real provider billing |
| Proxy host control and failure behavior | Passed | Reproduced fail-before/pass-after; target fetch mocked |
| Static internal resource/link existence | Passed | Original 24 pages had no missing local href/src targets; dynamic URLs not covered |
| HTML inline JavaScript parse | Passed | All classic inline scripts; not JS execution or DOM validation |
| Public pages, clean local URLs, malformed/invalid path, HEAD/405 | Passed | Local HTTP tests; no claim of full hosted routing equivalence |
| Live schema connectivity and expected API objects | Passed | Read-only metadata: 24 tables; recent enquiry tables present |
| Anonymous visibility of 15 private tables | Passed, limited | Seven HEAD responses had `*/0`; eight were 401; no rows fetched. Empty result alone cannot prove every RLS boundary |
| Live storage/auth configuration | Passed, limited | Résumé bucket private/5 MiB; site-media public/5 MiB; email/phone/Google enabled; email and phone autoconfirm false |
| Live candidate signup/login/recovery/profile/application CRUD | Blocked | Shared live DB is read-only; no isolated accounts supplied |
| Live staff permission boundaries and admin review | Blocked | No candidate/staff account pair; no production writes authorized |
| Real SMS/WhatsApp/email, webhooks and scheduled worker | Blocked | Sending not authorized; provider delivery and scheduler not exercised |
| Browser forms, back/forward, mobile/tablet/desktop, cross-browser | Blocked | UI tools unavailable during attempt |
| Upload byte validation, archive expansion, moderate load, race behavior | Not Tested | No destructive/flood testing; targeted isolated follow-up needed |
| Persistence across process restart, DB disconnection/reconnection | Not Tested | No isolated deployment/DB available |
| Backup restore, RPO/RTO, runtime rollback | Blocked | Infrastructure evidence/access and isolated restoration target required |
| Payments/refunds execution | Not Applicable | No payment integration found |
| Search Console and Google index coverage | Blocked | No connected Search Console data |

No code-coverage percentage was measured. Passing tests are evidence of the exercised behaviors, not proof that every route and permission combination is correct.

## Database health and integrity

Read-only REST schema retrieval succeeded against the owner-confirmed live project. All 18 application-referenced tables appear in the 24-table service metadata. The new consultation, DYF and GenAI enquiry objects are present, despite migration notes saying some were not yet applied. This proves object availability, not exact equality between deployed function bodies and local SQL.

Private-table HEAD checks and bucket settings are positive evidence. No live create/update/delete was performed, no authenticated cross-user rows were requested, and no production migration was run. RLS policy definitions, grants for every RPC, FK/index consistency, slow queries, live transaction rollback, query p50/p95/p99, pooling, at-rest encryption and DB network exposure remain unverified. Existing indexes and ownership constraints were reviewed in source; the versioning race remains open. Backups may exist, but their frequency/encryption and successful restoration were not established.

For a staging rehearsal, apply the documented migration sequence to a fresh project, seed synthetic owner/other/staff users, run the same migrations again, exercise storage ownership plus all RPC grants, force one transaction rollback, restart the backend during import, and restore a separate database backup. Never use production records as fixtures.

## Performance and application size

No LCP, INP, CLS, FCP, TBT, Lighthouse, browser CPU/memory, production API percentiles, or field p75 values were measured. Required acceptance remains LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at field p75 where available, plus agreed mobile/desktop and API/load budgets. A build alone cannot satisfy these gates.

| Measurement | Before | After | Interpretation |
|---|---:|---:|---|
| Source HTML total | 1,518,961 B / 24 pages | 1,527,378 B / 25 pages | Added metadata and 404 document; no claimed speed improvement |
| Sum of individually gzipped HTML | 344,614 B | 346,572 B | Local gzip calculation, not measured browser network transfer |
| High backend registry entries | 5 | 0 | Dependency security result, not performance |
| Canonical page count | 3 | 17 | Public static metadata coverage |
| Final static build | Not separately retained | 50,104,617 B / 159 files | Deployable disk size; not homepage payload |

Largest assets: quantized model 22,972,370 B; WASM runtime 14,264,838 B; placements atlas 1,736,424 B; syllabus PDF 810,696 B; three staff JPEGs roughly 0.63–0.67 MB each; Three.js 603,445 B. The model and WASM dominate the staff-tool build and should remain lazy-loaded. None of the generated assets exceeds 25 MiB. HTML totals include inline JS/CSS, so external JS/CSS figures alone undercount execution/style payload.

Public HTTP probes observed Brotli at both old and Pages hosts. Their 77–1,613 ms single-request elapsed measurements include client/network/body overhead; they are **not TTFB percentiles, Core Web Vitals or a comparative benchmark**. No slow-network or moderate-load claim is made.

Priorities: measure a production-like Pages/Cloud Run staging release on mobile and desktop; inspect homepage scripts and the placements atlas; consider WebP/AVIF for staff photos with visual checks; verify reduced-motion behavior; inspect lazy model loads and concurrent OCR memory. No broad image re-encoding or brand redesign was performed.

## SEO and Google readiness

The 17 public static content pages now have apex-domain canonicals consistent with `DEPLOY.md`, sitemap entries, OG identity/URL and Twitter card metadata. Each original HTML page already had one H1, a language attribute, and alt attributes on its static images. Static alt presence does not establish useful descriptions or layout stability.

Private profiles/enrolment and staff pages are excluded from the sitemap and receive noindex through source metadata and/or headers. Job-detail URLs are query-dependent and JavaScript-populated; they are excluded from the static sitemap until accurate per-job canonicals, crawlable content, HTTP missing-job handling and JobPosting lifecycle data can be implemented. No generic JobPosting markup was fabricated.

Live Pages still serves old missing-file behavior until deployment. The apex and www custom hosts both returned 200 without consolidation during the audit, and still show the old site. Configure/verify the chosen canonical redirect during authorized cutover. The prepared Pages-host noindex rule prevents staging-domain indexing after release; it does not isolate its database or restrict access.

Search Console ownership, sitemap submission, index coverage, impressions/clicks, rich-result validation, local Business Profiles, content originality and claim substantiation remain unverified. Terms/fee/refund information and legitimate testimonials improve trust but require owner-approved content. Technical readiness never guarantees a search ranking.

## Privacy, legal and accessibility gaps

India/Kerala is the evidenced operating/target context: Indian phone validation, Kerala courses/jobs and business addresses. Data includes names, contact details, age, education/employment, career preferences, résumés, applications, consent preferences, IP/rate records and auth identifiers. The policy names Supabase, Meta, Google, Cloudflare and AI providers; actual deployment region, subprocessors, contractual terms and cross-border handling need confirmation. GDPR applicability is not established merely because a website is accessible in Europe; assess targeting/monitoring before asserting obligations.

The DPDP Act and Rules have **phased commencement**; do not treat all obligations as already effective or all as deferred. As of 1 November 2026, counsel should map the exact notified provisions and dates to the business, including upcoming phases. Consult the [MeitY Rules and enforcement documents](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025%3B) and [NIST's government crosswalk describing phased commencement](https://www.nist.gov/privacy-framework/nist-privacy-framework-10-digital-personal-data-protection-act-2023-and-rules-2025). A privacy page is not compliance certification.

| Check | Assessment |
|---|---|
| Privacy notice and contact channel | Present; visible signup notice link added; legal accuracy needs review |
| Notifications/withdrawal | Consent and STOP handling exist with isolated tests; real delivery/withdrawal not exercised |
| Retention/deletion | Inconsistent one-hour claim; no validated deletion/backup retention procedure; 30-day request promise operationally unverified |
| Children | Age 15–17 accepted; verifiable guardian procedure absent; launch decision required |
| Terms, fees, cancellation/refunds | No approved terms page identified; applicability depends on enrolment/payment arrangements |
| Data sharing and AI | Providers disclosed broadly; purpose minimization, contracts and provider retention/training settings unverified |
| Cookie/embed consent | Policy acknowledges Instagram cookies; browser loading/consent behavior untested; determine jurisdiction-specific requirements |
| Copyright/licences and testimonials | Runtime licences partly bundled; complete attribution/model/stock/student-photo releases and placement claims not verified |
| Grievance/rights process | Contact details and response promises present; identity verification, export/deletion and complaint workflow not tested |

Accessibility was assessed against the scope of [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Corrected source issues include labels, a keyboard-operable password toggle, account-dialog semantics and focus behavior. Hidden honeypots and hidden college/file controls triggered the static label heuristic; they were not indiscriminately treated as visible unlabeled fields. Contrast, visible focus under real CSS, touch sizes, zoom/reflow, motion, error announcements, screen readers and every modal's behavior remain unverified. No WCAG AA conformance claim is made.

## C. Evidence-based scorecard

These are **completion scores for the explicitly listed audit gates**, not security ratings, legal certification, test coverage, or an estimate of undiscovered defects. Formula: 100 × passed gates ÷ listed applicable gates, rounded. Failed and blocked gates score zero so missing evidence cannot improve the score. A “source” gate measures only its named source check. Unmeasured categories are Not Assessed.

| Category | Score / 100 | Gates and confidence |
|---|---:|---|
| Security | 67 | 4/6: proxy regression, private-file denial, high-dependency remediation, limited anonymous-read check pass; complete script CSP fails; live cross-role tests blocked. Moderate confidence, scoped |
| Functionality | 40 | 2/5: website and backend local suites pass; live candidate journey, staff journey, delivery journey blocked. High confidence in local outcomes, low live confidence |
| Frontend quality | 67 | 2/3: static links and inline syntax pass; multi-viewport browser acceptance blocked. Low visual confidence |
| Backend reliability | 60 | 3/5: owner-route tests, error/cache tests, local import tests pass; restart durability fails source review; multi-instance/load check blocked. Moderate confidence |
| Database integrity | 40 | 2/5: live schema availability and isolated SQL pass; atomic versioning fails source review; live CRUD and restore blocked. Moderate source/low live-integrity confidence |
| Performance | Not Assessed | Asset sizes measured; browser/load/field acceptance unmeasured |
| Technical SEO | 75 | 3/4: static metadata, sitemap/build, 404 artifact pass; deployed crawl/index checks remain unsatisfied. Moderate local confidence |
| Accessibility | Not Assessed | Semantic/keyboard checks partial; no representative rendered/assistive-tech assessment |
| Privacy/legal readiness | 25 | 1/4: notice availability passes; retention and minors gaps fail; counsel signoff blocked. Technical gaps only |
| Deployment readiness | 40 | 2/5: local build and CI-definition gates pass; domain cutover fails; restore and runtime rollback blocked. Low deployed confidence |

## D. Prioritized remediation plan

Complexity: S = usually hours; M = roughly 1–3 engineering days; L = multiple days and/or coordinated provider/legal work. These are planning ranges, not commitments.

| Priority | Action | Complexity | Dependencies | Required validation |
|---|---|---|---|---|
| P0 | Review and release both repos' security fixes; retain rollback revisions | M | Owner release authorization, hosting access, configured origin secret | Repeat proxy/private-file/no-store/health smoke checks on staging, then deployed revision |
| P0 | Create isolated Supabase/Cloud Run/Pages staging with candidate A/B and staff accounts | M | Separate secrets, data and redirect configuration | Positive/negative auth, IDOR, profile/storage/application/admin journeys; no production writes |
| P0 | Prove backup restoration and release rollback; define RPO/RTO | M–L | Backup plan/access, isolated restore target, infrastructure owner | Restore and compare integrity; roll back code and compatible migrations in rehearsal |
| P0 | Decide and implement minor-user policy and approve notice/terms/retention | M–L | Business owner and qualified legal review | Age/guardian tests, actual data deletion/export exercise, approved public content |
| P0 | Establish browser/accessibility/performance acceptance results | M | Working browser test environment and staging | Mobile/tablet/desktop, keyboard/screen reader, Lighthouse lab results, agreed API/load budget |
| P1 | Make imports durable and recover stale processing jobs | M–L | Queue/storage design and staging | Terminate worker mid-import; recover once, clean files, surface useful failure |
| P1 | Migrate anonymous upload drop-box to owner-scoped storage with quotas | M | Coordinated frontend/RPC/storage policy and legacy-object plan | Two-user upload/read/signing tests, MIME/size/quota tests; preserve existing applications |
| P1 | Make résumé history/save atomic | M | SQL RPC/migration, conflict UX | Concurrent saves, unique versions, rollback and retry/idempotency tests |
| P1 | Resolve remaining runtime dependency advisories by reachability and targeted updates | S–M | Lockfile review; avoid forced major downgrades | Runtime audit, import/render/API regression suite |
| P1 | Verify notification scheduler, provider credentials, retries/STOP and alerting | M | Explicit authorized test recipients and isolated queue | Delivery, duplicate prevention, provider outage, webhook forgery rejection, opt-out |
| P1 | Cut over apex/www, consolidate redirects, verify HTTPS and all header rules | M | Domain owner and release approval | One canonical host, correct 404/XML/text content types, Pages noindex, no cache of private APIs |
| P2 | Complete script CSP/SRI/resource review and staff MFA assessment | M | Browser runtime inventory; provider-compatible policy | Report-only observation first, then enforced policy without breaking flows |
| P2 | Per-job crawlable pages/canonicals and valid JobPosting lifecycle | M | Job publishing design and expiration policy | Rich Results test, missing/expired statuses, index coverage |
| P2 | Optimize measured images/scripts/model loading; review unused dependencies | S–M | Browser waterfall and real user budgets | Before/after mobile results and visual comparison |
| P2 | Consolidate migration history and stale deployment instructions | S | Observed deployed definitions and release owner | Fresh project setup and repeatable upgrade rehearsal |
| P3 | Expand cross-browser automation, monitoring/SLOs and field performance data | L | Stable staging and CI credentials with least privilege | Scheduled synthetic journeys, alert drills and p75 field dashboards |

## E. Final launch checklist

| Critical check | Status | Condition |
|---|---|---|
| Local website/backend regression suites | Pass | 107 and 126 tests respectively |
| Local production website build and public-file exclusions | Pass | Final build and existing publish allowlist tests |
| New high-severity source defects remediated | Pass locally | Must release both repositories |
| Production contains the audited fixes | Blocked | No deployment performed |
| No high/critical registry findings in resolved npm trees | Pass locally | Runtime moderate findings still require review |
| Candidate signup/login/recovery and saved profile/application journey | Blocked | Dedicated staging/test accounts needed |
| Staff and cross-user permission boundaries | Blocked | Real account boundary tests outstanding |
| Anonymous private-table read checks | Pass, limited | No accessible rows observed; not a substitute for cross-user tests |
| Résumé storage private and size-limited | Pass | Read-only live bucket configuration |
| Live CRUD, uniqueness, concurrency and persistence | Blocked | Shared production database read-only |
| Durable import processing after restart | Fail | In-process background execution |
| Backup restore/RPO/RTO and usable rollback | Blocked | No validated recovery exercise |
| Isolated staging cannot modify production | Fail | Supplied preview configuration uses shared live project |
| Canonical domain serves new release | Fail | Public domain still old site |
| Correct deployed unknown-route/crawler behavior | Fail | Live Pages still returns homepage for missing paths/files |
| Notifications, webhooks, scheduling and opt-out | Blocked | No real delivery test authorized/performed |
| Error monitoring, alerts and log retention | Blocked | Deployed controls not inspected |
| Mobile/desktop/cross-browser acceptance | Blocked | Browser tooling failure |
| Performance/availability acceptance | Blocked | No representative performance/load measurements |
| WCAG 2.2 AA acceptance | Blocked | Rendered and assistive-tech testing needed |
| Privacy/minor-user/retention/terms approval | Fail / Blocked | Confirmed technical gaps and legal decisions outstanding |
| Copyright/claims/licence approval | Blocked | Owner evidence needed |
| Payment/refund integration execution | Not Applicable | No gateway in inspected code |

## F. Deployment decision and release handoff

**NO-GO.** A local build and passing suites do not meet the requested launch gates. In particular, live business journeys, cross-user permissions, recovery, browser/performance acceptance and applicable legal requirements remain unresolved. Existing high source risks and dependency findings have been reduced, but the live deployment has not changed.

Release the website and résumé repositories independently, deploy only approved matching migrations/Edge Functions, and rehearse against an isolated database. Use immutable deployment revisions and explicit template seeding only when definitions change. Preserve the current DNS/revisions as rollback material. Repeat the launch checklist against the exact staged release before authorizing cutover. Do not run the cumulative schema indiscriminately against production: several migrations supersede older authorization rules.

Standards used to frame the review: [OWASP ASVS 5.0.0](https://asvs.owasp.org/), [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/), and [WCAG 2.2](https://www.w3.org/TR/WCAG22/). The missing-page finding was checked against [Cloudflare's documented 404/SPA behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/). This is a scoped review, not a claim of complete ASVS conformance.

## Page-by-page SEO inventory

The following generated table covers all website HTML files after correction. Presence checks do not validate rendered quality or live indexability. The three staff pages rely in part on `_headers` for noindex; job-detail metadata still needs a per-job solution.

| Page | Scope | Description | Canonical before → after | H1 count | Missing static alt | OG title |
|---|---|---|---|---:|---:|---|
| 404.html | Error document; noindex | No | Missing/new → Excluded/pending | 1 | 0 | No |
| admin-password.html | Private/transactional; noindex | No | Missing/new → Excluded/pending | 1 | 0 | No |
| admin.html | Private/transactional; noindex | No | Missing/new → Excluded/pending | 1 | 0 | No |
| b-school.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| career-consultation.html | Public; sitemap | Yes | Present → Apex canonical | 1 | 0 | Yes |
| course-details.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| create-profile.html | Private/transactional; noindex | Yes | Missing/new → Excluded/pending | 1 | 0 | No |
| data-analytics-course-details.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| enroll.html | Private/transactional; noindex | Yes | Missing/new → Excluded/pending | 1 | 0 | No |
| finishing-school.html | Public; sitemap | Yes | Present → Apex canonical | 1 | 0 | Yes |
| genai-course-details.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| hr-course-details.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| index.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| internship-profile.html | Private/transactional; noindex | Yes | Missing/new → Excluded/pending | 1 | 0 | No |
| internships.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| java-course-details.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| job-details.html | Dynamic job; open SEO work | Yes | Missing/new → Excluded/pending | 1 | 0 | No |
| jobs.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| marketing.html | Private/transactional; noindex | No | Missing/new → Excluded/pending | 1 | 0 | No |
| our-story.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| placements.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| privacy.html | Public; sitemap | Yes | Present → Apex canonical | 1 | 0 | Yes |
| sales-engineering-course-details.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| talent-hunt.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |
| tech-school.html | Public; sitemap | Yes | Missing/new → Apex canonical | 1 | 0 | Yes |

### Reproduce the checks

- Website: `npm ci`, install `@electric-sql/pglite@0.5.10` under `tmp/matching-tests` as the workflow does, then `npm test` and `npm run build`.
- Résumé repository: in `Resume/backend`, run `npm ci`, `npm test`, and `npm audit --omit=dev`.
- Inventory: `node scripts/audit-project.cjs final` (requires the available nested résumé checkout for its HTML parser and dependency inventory).
- Read-only live metadata: `node scripts/audit-database.cjs`; scoped live GET/HEAD checks: `node scripts/audit-live-readonly.cjs`. Only run against an owner-authorized project; credentials are read from existing local configuration and never printed.
- No CI workflow, build, or audit command here deploys the site or runs production migrations. Hosted CI itself was not exercised in this task.
