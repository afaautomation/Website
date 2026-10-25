# Automatic applicant filtering

## Current admin behaviour

The automatic reviewer now adds a local AI-assisted review workflow. It checks for contradictory skill declarations and under-specified jobs, lists evidence-backed strengths and gaps, and prepares follow-up questions for HR. Conflicts and title-only jobs require review even with a high keyword score. Follow-up questions are suggestions displayed in the admin console; nothing is sent to applicants automatically.

For missing skill matches, the existing MiniLM neural model runs locally in a browser worker and compares declared skills with job requirements. The five strongest related-evidence hints above 50/100 text similarity are shown for human verification. This threshold is heuristic, not calibrated hiring confidence. Similarity never awards score points, proves qualification equivalence, or changes HR status. The model receives only bounded professional skill/criterion strings and temporary numeric indexes, not names or contact data. Work is queued per session; sign-out terminates it. A 60-second timeout or missing model files shows an explicit unavailable notice while retaining the evidence-based score. No external inference API is used. The worker loads installed model assets from the site's own origin.

Cross-sector regression coverage includes all 12 career areas, 39 fields and 186 field-specific skill entries in the catalogue, plus custom marine, dental, renewable-energy and textile skills. The same matching algorithm applies to every job; there is no Python/Java-only path. Multiword skill alternatives retain their full meaning, including Machine Learning, Attention to detail and Time management. Course spelling aliases also cover commerce, arts, business, education, social work, law, pharmacy, dentistry and medicine, without making different degrees equivalent. These checks do not validate professional licences or establish real-world hiring accuracy.

The local analysis layer now groups simple OR alternatives, excludes negative skill statements (including “never used”), separates skill evidence from academic fields and career interests, and routes absent evidence to Needs information. Title/description/responsibility context is capped at 20% when explicit criteria exist. View details explains alternatives, evidence and weighted points. These are deterministic interpretation rules; the automatic scorer is not a general-purpose reasoning language model. Complex conditions and unrecognised phrasing still need human review. All 11 exploratory quality scenarios now pass; that is regression coverage, not a measured hiring-accuracy rate.

The admin page now automatically scores **all submitted applicant profiles across all jobs and internships** after staff sign-in, without opening job cards or pressing an analysis button. It reads every applicant page, shares results across views, and refreshes jobs and profiles 60 seconds after each scan completes. Sign-out cancels the scan and clears its in-memory data. It runs while the authenticated admin page is open, not as an always-on server task. Candidate accounts without an application are not included. Applications without a current job remain visible with a request for a linked job rather than an invented score.

The applicant panel no longer shows the matching-rule editor, threshold input, Apply threshold or Reanalyse controls. Cards display **Keyword match**, and View details lists matched/missing keywords, evidence and point weights. Matched suggestions require at least 60/100 and no missing or unmet configured requirement. This is a review suggestion; HR status and notifications are unchanged.

`js/automatic-applicants.mjs` extracts keywords from each job's listed skills, title, requirements, responsibilities and description. It recognizes phrases from every field in the career catalogue and also accepts terms outside that catalogue, so new occupations do not require code changes or manual matching rules. Listed skills weigh 4 points; requirement phrases weigh 3; other recognized phrases weigh 2; requirement words weigh 2; title/description/responsibility words weigh 1. Structured criteria use at least 3 points and configured skill importance. Duplicates keep their highest weight. At most 150 keywords are retained, highest weight first. The score is matched points divided by total points, scaled to 100. Repeated keyword stuffing does not add points.

The numeric score remains a deterministic local keyword comparison, **not neural inference or a validated measure of job readiness**. The local neural model supplies separate related-evidence hints in the automatic review; it does not power the numeric score. Existing explicit qualification, specialisation, experience and intake requirements remain separate eligibility checks. Missing essential evidence stays in All applicants for review. A job with insufficient professional text gets no invented score.

Only selected professional skills, soft skills, academic course/specialisation and career interests enter keyword matching. Legacy skill text is used only when structured skills are absent. Names, contact details, college, age, gender and resumes do not enter the score. Phrase boundaries and known aliases prevent Java/JavaScript or C++/C# from becoming interchangeable. Basic negations are excluded, but complex prose, synonyms outside the alias list and sparse profiles can still reduce keyword accuracy.

Legacy snapshots containing `null` career skills now fall back to saved application skills; explicit empty or “I don't know yet” answers do not. Combined degrees such as `B.Sc. · Artificial Intelligence` are split into course and specialisation. Keyword aliases recognise AI/Artificial Intelligence, ML/Machine Learning and other defined professional abbreviations without treating related but distinct disciplines as equivalent. Low-score cards list the leading unmatched keywords so a real job/profile mismatch is distinguishable from missing data.

Verification: `node --test tests/automatic-applicants.test.cjs tests/local-ai.test.cjs tests/applicant-matching.test.cjs tests/admin-workflows.test.cjs`. Tests cover every catalogue field, novel occupations, missing evidence, aliases, explicit eligibility, all-page loading, cache reuse, cancelled scans, automatic startup and retries. No production database updates or deployment are needed to preview this change locally; publish the rebuilt site to update the hosted admin page.

## Earlier local neural review implementation

This is a real pretrained neural language model, **Xenova/all-MiniLM-L6-v2**, running through Transformers.js and ONNX Runtime inside a browser worker. It is not a model trained from scratch or fine-tuned on Kompetenzen hiring outcomes. AI scores are integrated into the ordinary applicant cards, filters and details. Database rules remain authoritative for essential requirements.

## Use

Open Admin → Applicants → choose a job. AI analysis starts automatically, loading all pages through the staff-only endpoint. The same applicant cards show a score out of 100, a match suggestion and a short reason. **View details** contains the model evidence and requirement analysis. There is no separate AI panel or second applicant list.

The **Matched**, **All**, and **Not matched** tabs use the integrated analysis. A matched suggestion requires confirmed eligibility and an AI score at or above the adjustable threshold (initially 60/100, an uncalibrated starting setting). An unmet essential requirement or a score below the threshold produces a not-matched suggestion. Missing essential information or failed AI analysis remains **Needs information**, visible in All. Every successfully analysed profile retains its score even when not matched. Counts and ranking cover the entire job before 25-row pagination.

Scores are temporary in memory and do not update HR status, send notifications, or make hiring decisions. Tabs, thresholds and pagination reuse the completed analysis. **Reanalyse applicants**, Refresh, leaving the job, or locking the console clears it. Reanalyse after profile or requirement changes. CSV exports the current page with AI score, match suggestion and reason.

## Install and build

Requires Node.js 20 or newer. From the project root:

```text
npm ci --ignore-scripts
npm run setup:ai
node server.js
```

Open `http://localhost:3000/admin.html`. The normal staff sign-in and Supabase connection are still required to retrieve real applicants. “Local AI” describes inference, not an offline copy of the applicant database.

The setup command downloads public model files from Hugging Face, checks the committed revision and SHA-256 hashes in `scripts/local-ai-model-lock.json`, and bundles the pinned runtime. The model weights are approximately 23 MB; the CPU/WASM runtime is approximately 14 MB. Downloads happen during setup/build, not through an AI inference API. Subsequent setup runs reuse verified model files.

`npm run build` (or the existing Cloudflare command `node scripts/build-pages.cjs`) runs model setup before copying public assets to `dist`. Cloudflare must install this root package's development dependencies. Large generated assets under `js/models` and `js/vendor/local-ai` are intentionally ignored by Git. Each downloaded model asset must fit the 25 MiB Pages limit. Publish the complete `dist` folder, including model and runtime files. Do not publish only the HTML.

Apply `migrations/20261020_local_profile_scoring.sql` after its prerequisites for the preceding rules-score changes and semester/year evidence. The AI feature itself does not require a new database table, privileged secret, or inference service. No live database migration or production deployment was performed as part of this local implementation.

## Meaning of the score

The model embeds configured criteria and the applicant's self-reported course, specialisation, career area/field, technical skills, and soft skills. Each requirement is compared only to evidence from its corresponding category. Academic alternatives use the closest comparison. Skill importance follows the job's configured importance.

Profile fit uses the job's configured skills, academics and experience weights (default 70/20/10). Skills use their configured importance. Academic criteria accept any configured alternative, including recognised spelling aliases such as B.Sc./BSc and B.Tech/BTech. Distinct disciplines remain distinct: Computer Science, AI and AI/ML must be explicitly accepted by the job. The rules editor expands academic aliases for compatibility with the existing database matcher.

Points require a reported match or a recognised spelling alias. Missing or merely related evidence earns zero. Relevant experience earns proportional points up to the configured target, only for the matching experience scope. Unknown experience earns zero; it does not redistribute the experience weight. When a category has no configured criteria, its weight transfers to the first active category in skills, academics, experience order. Career interests, semester and completion year are eligibility checks, not extra score bonuses. Evidence coverage indicates populated criteria, not verified competence.

The local neural model still compares evidence and requirements. Its cosine similarities appear as related-evidence review hints in View details; they are not converted into earned points. A high similarity between two skill descriptions does not establish that the applicant selected or possesses the required skill. Cards show the exact unmet requirement and reported value where available, and details show points earned in each category. Reanalysis uses current applicant rule snapshots and rejects inconsistent snapshots.

Semester and completion year remain explicit intake rules. College, names, contact information, age, gender, resume text, self-described career stage, and offer preferences do not enter the model. College is shown only as context. AI similarity never satisfies or overrides a failed essential requirement. Related terminology is not proof that an applicant has a skill or an equivalent qualification.

This is an evidence-based rubric assisted by local semantic comparisons, not a suitability probability or validated hiring predictor. The default threshold is uncalibrated. Validate against independently reviewed job-specific examples before relying on it operationally. No applicant data was used for training.

## Privacy and failure behavior

Remote model loading is disabled. The worker rejects external-origin fetches; model and runtime assets load from the website's own origin. Only allowlisted professional evidence enters the worker; results stay in browser memory. No AI provider receives applicant profiles. The site still uses its existing Supabase data connection and existing third-party frontend libraries.

Model failures show an explicit error and keep the applicants available for review; rules are never relabelled as AI output. Leaving the job or locking the console terminates the worker. Stale analysis cannot replace a newly selected job. A changing applicant count or repeated IDs during pagination causes an error instead of silently returning a partial ranking. Concurrent edits with an unchanged count are not a transactional snapshot; re-run the review after edits.

## Verification

```text
node --test tests/local-ai.test.cjs tests/applicant-matching.test.cjs tests/admin-workflows.test.cjs
```

The model test disables network fetches while loading weights from disk and performing real inference. Synthetic software-testing text similarities are 100 for exact wording, 57.3 for quality-assurance testing, and 13.1 for food preparation. Only the reported exact skill earns points; the other similarities are review hints. Regression tests cover degree spellings, explicit discipline alternatives, configured weights, absent experience, threshold eligibility and stale rules. These are implementation checks, not an evaluation of hiring accuracy.

Sources: [model repository and model card](https://huggingface.co/Xenova/all-MiniLM-L6-v2), [original model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), [Transformers.js local model configuration](https://huggingface.co/docs/transformers.js/en/custom_usage). The model and Transformers.js use Apache-2.0; ONNX Runtime uses MIT. Runtime licence notices are bundled with the generated assets.
