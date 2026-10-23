// Pure model-scoring logic shared by the browser worker and offline regression tests.
import './matching-terms.js';
export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const { canonical, compact } = globalThis.MatchingTerms;
const clean = value => typeof value === 'string' ? value.trim().slice(0, 200) : '';
const known = value => clean(value) && !/^i don[’']t know yet$/i.test(clean(value));
const names = values => Array.isArray(values) ? [...new Set(values.map(clean).filter(known))].slice(0, 40) : [];

export function makePlan(rules = {}, evidence = {}) {
  const career = evidence.career || {};
  const criteria = [];
  for (const [key, label] of [['skills', 'Technical skill'], ['softSkills', 'Soft skill']]) {
    for (const skill of (Array.isArray(rules[key]) ? rules[key] : []).slice(0, 30)) {
      if (!known(skill.name)) continue;
      criteria.push({ group: 'skills', kind: key, label, target: clean(skill.name), candidates: names(career[key]),
        importance: Math.max(1, Math.min(100, Number(skill.importance) || 1)), essential: !!skill.essential });
    }
  }
  for (const [key, source, label] of [
    ['qualifications', 'qualification', 'Required course'],
    ['specialisations', 'specialisation', 'Required specialisation'],
    ['preferredQualifications', 'qualification', 'Preferred course'],
    ['preferredSpecialisations', 'specialisation', 'Preferred specialisation']
  ]) {
    const alternatives = compact(names(rules[key]), source);
    if (alternatives.length) criteria.push({ group: 'academics', kind: source, label, alternatives,
      target: alternatives.join(' / '), candidates: names([evidence[source]]), importance: 1, essential: !key.startsWith('preferred') });
  }
  for (const [key, source, label] of [['careerArea', 'area', 'Career interest'], ['careerField', 'field', 'Career field']]) {
    if (known(rules[key])) criteria.push({ group: 'interests', kind: key, label, target: clean(rules[key]),
      candidates: names([career[source]]), importance: 1, essential: true });
  }
  // Names, college, gender, age, contact details, resume text and hiring outcomes
  // are deliberately never supplied to the model. Intake dates remain explicit rules.
  return criteria;
}

export function cosine(a, b) {
  if (!a?.length || a.length !== b?.length) throw Error('Invalid model embedding');
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw Error('Non-finite model output');
    dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2;
  }
  if (!aa || !bb) throw Error('Empty model embedding');
  return Math.max(0, Math.min(1, dot / Math.sqrt(aa * bb)));
}

export async function scoreProfile(rules, evidence, embed) {
  const plan = makePlan(rules, evidence);
  const targetMonths = Math.max(Number(rules.preferredMonths) || 0, Number(rules.minimumMonths) || 0);
  if (!plan.length && !targetMonths) throw Error('Configure job skills, academics, career interests or experience before AI review.');
  const details = [];
  for (const criterion of plan) {
    let similarity = 0, closest = null, exact = false;
    for (const target of criterion.alternatives || [criterion.target]) {
      for (const candidate of criterion.candidates) {
        const same = canonical(target, criterion.kind) === canonical(candidate, criterion.kind);
        // Even exact matches pass through inference: this is a real embedding model.
        const semantic = cosine(await embed(target), await embed(candidate));
        const value = same ? 1 : semantic;
        if ((!exact && same) || (!exact && value > similarity) || closest === null) {
          similarity = value; closest = candidate; exact = same;
        }
      }
    }
    details.push({ ...criterion, candidates: undefined, similarity: Math.round(similarity * 1000) / 10, credit: exact ? 1 : 0,
      closest, exact, missing: !criterion.candidates.length });
  }
  // Professional dropdowns are explicit declarations. Related wording is an AI
  // review hint, not evidence that an unselected skill or qualification is held.
  const baseWeights = rules.weights || { skills: 70, academics: 20, experience: 10 };
  if (['skills','academics','experience'].some(k => !Number.isInteger(baseWeights[k]) || baseWeights[k] < 0) ||
      baseWeights.skills + baseWeights.academics + baseWeights.experience !== 100) throw Error('Job scoring weights must total 100.');
  const active = ['skills','academics','experience'].filter(g => g === 'experience' ? targetMonths > 0 : details.some(d => d.group === g));
  const unused = ['skills','academics','experience'].filter(g => !active.includes(g)).reduce((n,g) => n + baseWeights[g],0);
  const components = {};
  for (const group of active) {
    const rows = details.filter(d => d.group === group);
    const total = rows.reduce((n, d) => n + d.importance, 0);
    const ratio = group === 'experience' ? Math.min((relevantMonths(rules,evidence) ?? 0) / targetMonths, 1) : rows.reduce((n,d) => n + d.credit * d.importance,0) / total;
    const weight = baseWeights[group] + (group === active[0] ? unused : 0);
    components[group] = { points: Math.round(ratio * weight * 10) / 10, weight };
  }
  const checks = requirementChecks(rules,evidence);
  const score = active.length ? Math.round(Object.values(components).reduce((n,c)=>n+c.points,0)*10)/10 : null;
  return { model: MODEL_ID, version: 2, score, components, details, checks,
    experience: targetMonths ? { reportedMonths: relevantMonths(rules,evidence), targetMonths, scope: rules.experienceScope } : null,
    coverage: Math.round((details.filter(d => !d.missing).length + (targetMonths && relevantMonths(rules,evidence) !== null ? 1 : 0)) / (details.length + (targetMonths ? 1 : 0) || 1) * 100),
    reviewRequired: true };
}

function relevantMonths(rules,evidence) {
  const n = evidence.relevantMonths;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 600 &&
    evidence.experienceScope === rules.experienceScope ? n : null;
}

export function requirementChecks(rules,evidence) {
  const checks = makePlan(rules,evidence).filter(c => c.essential).map(c => {
    const match = c.candidates.some(candidate => (c.alternatives || [c.target]).some(target => canonical(candidate,c.kind) === canonical(target,c.kind)));
    const status = match ? 'met' : !c.candidates.length || c.group === 'skills' ? 'missing' : 'unmet';
    return {label:c.label, required:c.target, provided:c.candidates.join(', ') || 'not provided', status,
      reason: `${c.label}: requires ${c.target}; reported ${c.candidates.join(', ') || 'not provided'}.`};
  });
  for (const [key,source,label] of [['semesters','semester','Semester'],['graduationYears','graduationYear','Completion year']]) {
    const accepted = names(rules[key]);
    if (!accepted.length) continue;
    const actual = evidence[source] == null ? '' : String(evidence[source]).trim();
    checks.push({label,required:accepted.join(' / '),provided:actual || 'not provided',
      status: !actual ? 'missing' : accepted.includes(actual) ? 'met' : 'unmet',
      reason: `${label}: accepts ${accepted.join(' / ')}; reported ${actual || 'not provided'}.`});
  }
  if (Number(rules.minimumMonths) > 0) {
    const n = relevantMonths(rules,evidence);
    checks.push({label:'Relevant experience',required:rules.minimumMonths + ' months',provided:n == null ? 'not confirmed for this role' : n + ' months',
      status: n == null ? 'missing' : n >= rules.minimumMonths ? 'met' : 'unmet',
      reason:`Relevant experience: requires ${rules.minimumMonths} months; reported ${n == null ? 'not confirmed for this role' : n + ' months'}.`});
  }
  return checks;
}

export async function collectApplicants(fetchPage, isCurrent = () => true) {
  const rows = [], ids = new Set();
  let expected;
  for (let offset = 0; ; offset += 100) {
    if (!isCurrent()) throw Error('Review cancelled');
    const data = await fetchPage(offset);
    if (!isCurrent()) throw Error('Review cancelled');
    if (!Array.isArray(data?.rows) || !Number.isInteger(data.total) || data.total < 0) throw Error('Invalid applicant response');
    if (expected === undefined) expected = data.total;
    if (data.total !== expected) throw Error('Applicants changed during loading. Please run the review again.');
    for (const row of data.rows) {
      if (ids.has(row.id)) throw Error('Applicant order changed during loading. Please run the review again.');
      ids.add(row.id); rows.push(row);
    }
    if (rows.length === expected) return rows;
    if (!data.rows.length || rows.length > expected) throw Error('Incomplete applicant list. Please refresh.');
  }
}

export function resolveRules(applicants,fallback) {
  const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ?
    Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])) : value;
  const stable = value => JSON.stringify(ordered(value));
  const snapshots = applicants.map(a=>a.match_result?.rules).filter(r=>r && Object.keys(r).length);
  if (!snapshots.length) return fallback;
  if (snapshots.some(r=>stable(r)!==stable(snapshots[0]))) throw Error('Job rules changed during loading. Refresh and reanalyse the applicants.');
  return snapshots[0];
}
