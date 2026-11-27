const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

// The employer page must show the same "Keyword match" the HR console shows for the same applicant.
test('companies see the same Keyword match and verdict as the HR console', async () => {
  const automatic = await load('js/automatic-applicants.mjs');
  const agent = await load('js/applicant-agent.mjs');
  const LocalApplicantAI = require(path.join(root, 'js/local-ai-ui.js'));

  const rules = { version: 2, source: 'career_preferences', careerArea: 'Business & Management', careerField: 'Human Resources & Recruitment',
    skills: [{ name: 'recruitment', essential: true, importance: 3 }, { name: 'payroll', essential: true, importance: 2 }, { name: 'excel', essential: false, importance: 1 }],
    softSkills: [{ name: 'communication', essential: false, importance: 1 }], weights: { skills: 70, academics: 20, experience: 10 },
    semesters: [], graduationYears: [], qualifications: ['bba', 'bcom', 'mba'], specialisations: ['hr', 'sales'],
    preferredQualifications: [], preferredSpecialisations: [], minimumMonths: 0, preferredMonths: 20, experienceScope: 'HR work' };
  // hr_jobs row as the HR console has it, and the same listing as employer_my_jobs returns it.
  const hrJob = { id: 'job-1', title: 'HR Manager', company: 'Kompetenzen', skills: 'Recruitment, Payroll, Excel',
    description: 'Lead hiring and HR operations for a growing team.', responsibilities: 'Run interviews and onboarding.',
    requirements: 'BBA or BCom or MBA in HR.', application_requirements: { matching: rules } };
  const employerJob = { id: 'job-1', title: hrJob.title, skills: hrJob.skills, description: hrJob.description,
    responsibilities: hrJob.responsibilities, requirements: hrJob.requirements, matching: rules };

  const applicants = [
    { id: 'a1', degree: 'B.Sc.', course_name: 'Artificial Intelligence', skills: 'HTML / CSS, Python', matched_skills: [],
      matching_evidence: { career: { area: 'Technology & Data', field: 'AI & Machine Learning', skills: ['HTML / CSS', 'Python'], softSkills: ['Communication'] },
        qualification: 'B.Sc.', specialisation: 'Artificial Intelligence', college: 'MET', semester: null, graduationYear: '2028', selectedSkills: [] },
      match_result: { status: 'not_matched', rules, reasons: [] } },
    { id: 'a2', degree: 'BBA', course_name: 'HR', skills: 'Recruitment, Excel', matched_skills: ['Recruitment'],
      matching_evidence: { career: { area: 'Business & Management', field: 'Human Resources & Recruitment', skills: ['Recruitment', 'Payroll', 'Excel'], softSkills: ['Communication'] },
        qualification: 'BBA', specialisation: 'HR', relevantMonths: 6, experienceScope: 'HR work' },
      match_result: { status: 'matched', rules, reasons: [] } }
  ];

  // HR console: keywordScore + agentReview + LocalApplicantAI.review, threshold 60.
  const admin = applicants.map(app => {
    const ai = automatic.keywordScore(hrJob, app, rules);
    ai.agent = agent.agentReview(hrJob, ai, automatic.professionalEvidence(app));
    return LocalApplicantAI.review({ ...app, ai_result: ai }, 60);
  });

  // Employer page: run its real scoreRows() on the shapes employer_applicants returns.
  const page = fs.readFileSync(path.join(root, 'employer.html'), 'utf8');
  const code = page.slice(page.indexOf('      function scoreRows('), page.indexOf('      async function loadApplicants('));
  const ctx = vm.createContext({ jobs: [employerJob], THRESHOLD: 60, LocalApplicantAI, JSON });
  vm.runInContext(code + '\nthis.scoreRows = scoreRows;', ctx);
  const strip = e => Object.fromEntries(['career', 'skills', 'qualification', 'specialisation', 'semester', 'graduationYear', 'relevantMonths', 'experienceScope']
    .filter(k => e[k] !== undefined && e[k] !== null).map(k => [k, e[k]]));
  const rows = applicants.map(app => ({ id: app.id, job_id: 'job-1', job_title: 'HR Manager', degree: app.degree, course: app.course_name,
    skills: app.skills, matched_skills: app.matched_skills, evidence: strip(app.matching_evidence),
    match: { status: app.match_result.status, reasons: [], rules } }));
  ctx.scoreRows(rows, [automatic, agent]);

  rows.forEach((row, i) => {
    assert.equal(row.review.score, admin[i].score, row.id + ' score');
    assert.equal(row.review.status, admin[i].status, row.id + ' verdict');
    assert.equal(row.review.label, admin[i].label);
  });
  assert.ok(typeof admin[0].score === 'number' && admin[0].score < 60 && admin[0].status === 'not_matched', 'the AI graduate is scored, not blank');
  assert.ok(admin[1].score > admin[0].score);
});
