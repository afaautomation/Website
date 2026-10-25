(function (root) {
  'use strict';
  let worker, cancel, generation = 0, cachedKey, pending, cachedRows = [];
  const labels = { matched: 'Matched', not_matched: 'Not matched', needs_information: 'Needs information', unconfigured: 'Matching not configured' };
  function reset() {
    generation++;
    worker?.terminate(); worker = null;
    cancel?.(); cancel = null; cachedKey = null; pending = null; cachedRows = [];
  }
  function score(rules, applicants, onProgress) {
    return new Promise((resolve, reject) => {
      const active = new Worker('/js/local-ai-worker.mjs', { type: 'module' });
      worker = active;
      const finish = () => { active.terminate(); if (worker === active) { worker = null; cancel = null; } };
      cancel = () => { finish(); reject(Error('Review cancelled')); };
      active.onerror = () => { finish(); reject(Error('AI could not start. Check the installed model files and retry.')); };
      active.onmessage = ({ data }) => {
        if (worker !== active) return;
        if (data.type === 'status') onProgress(data.text);
        if (data.type === 'error') { finish(); reject(Error(data.message)); }
        if (data.type === 'complete') { finish(); resolve(data.results); }
      };
      active.postMessage({ type: 'score', rules, applicants: applicants.map(a => {
        const e = a.matching_evidence || {}, c = e.career || {};
        return { id: a.id, evidence: { qualification: e.qualification, specialisation: e.specialisation,
          relevantMonths:e.relevantMonths, experienceScope:e.experienceScope, semester:e.semester, graduationYear:e.graduationYear,
          career: { area: c.area, field: c.field, skills: c.skills, softSkills: c.softSkills } } };
      }) });
    });
  }
  async function load({ key, rules, fetchPage, onProgress = () => {} }) {
    if (cachedKey === key && pending) return pending;
    reset(); cachedKey = key;
    const run = generation;
    pending = (async () => {
      const { makePlan, collectApplicants, resolveRules } = await import('./local-ai-core.mjs');
      const current = () => generation === run;
      if (!current()) throw Error('Review cancelled');
      onProgress('Loading applicants…');
      const applicants = await collectApplicants(fetchPage, current);
      const currentRules = resolveRules(applicants,rules);
      if (!applicants.length || (!makePlan(currentRules).length && !currentRules.preferredMonths && !currentRules.minimumMonths)) return applicants;
      try {
        const output = await score(currentRules, applicants, onProgress);
        if (!current()) throw Error('Review cancelled');
        const byId = new Map(output.map(r => [r.id, r.result]));
        if (byId.size !== applicants.length || applicants.some(a => !byId.has(a.id))) throw Error('AI returned incomplete results. Retry the analysis.');
        return applicants.map(a => ({ ...a, ai_result: byId.get(a.id) }));
      } catch (error) {
        if (!current()) throw error;
        return applicants.map(a => ({ ...a, ai_error: error.message }));
      }
    })();
    const rows = await pending;
    if (generation === run) cachedRows = rows;
    return rows;
  }
  function setHRStatus(id, status) {
    const row = cachedRows.find(a => String(a.id) === String(id));
    if (row) row.hr_status = status;
  }
  function review(app, minimum = 60) {
    const cutoff = Number.isFinite(Number(minimum)) ? Math.max(0, Math.min(100, Number(minimum))) : 60;
    const ai = app.ai_result;
    const score = Number.isFinite(ai?.score) && ai.score >= 0 && ai.score <= 100 ? ai.score : null;
    const eligibility = ai?.engine === 'keywords' && ai.eligibilityChecked ? 'matched' : app.match_result?.status || 'pending';
    const failed = (ai?.checks || []).filter(c => c.status === 'unmet');
    const missing = (ai?.checks || []).filter(c => c.status === 'missing');
    const storedFailures = (app.match_result?.reasons || []).filter(x => /does not meet|below essential|outside configured|explicitly not selected/i.test(x));
    let status, explanation;
    if (eligibility === 'unconfigured') {
      status = 'unconfigured'; explanation = 'Configure this job’s requirements to analyse its applicants.';
    } else if (eligibility === 'not_matched' || failed.length) {
      status = 'not_matched'; explanation = failed.length ? failed.slice(0,2).map(c=>c.reason).join(' ') : storedFailures.slice(0,2).join(' ') || 'An essential job requirement is not met. Open the analysis to review the configured criteria.';
    } else if(ai?.agent?.reviewNeeded) {
      status='needs_information';explanation=ai.agent.concerns.slice(0,2).join(' ');
    } else if (eligibility !== 'matched' || missing.length || ai?.hasEvidence === false || ai?.missingEvidence?.length) {
      status = 'needs_information'; explanation = missing.length ? missing.slice(0,2).map(c=>c.reason).join(' ') : ai?.missingEvidence?.length ? 'Profile evidence is missing for: '+ai.missingEvidence.slice(0,3).join(', ')+'. Career interests and degree titles do not prove these skills.' : 'Required evidence is missing or eligibility has not been confirmed.';
    } else if (score === null) {
      status = 'needs_information'; explanation = app.ai_error ? 'Analysis is unavailable. It will retry automatically.' : 'Not enough job information to calculate a keyword score.';
    } else if (score < cutoff) {
      status = 'not_matched'; explanation = `${ai?.engine === 'keywords' ? 'Keyword match' : 'Profile fit'} is below the ${cutoff}/100 match threshold.`;
      if(ai?.engine === 'keywords' && ai.missingKeywords?.length) explanation += ' Keywords not found: ' + ai.missingKeywords.slice(0,3).join(', ') + '.';
    } else {
      status = 'matched'; explanation = ai?.engine === 'keywords' ? `Keyword match reaches ${cutoff}/100; no configured requirement is unmet.` : `Essential requirements are met and profile fit reaches ${cutoff}/100.`;
    }
    return { status, label: labels[status], score, minimum: cutoff, explanation };
  }
  function page(applicants, { status = 'all', minimum = 60, offset = 0, limit = 25 } = {}) {
    const rows = applicants.map(a => ({ ...a, ai_review: review(a, minimum) }));
    const counts = { all: rows.length, matched: 0, not_matched: 0, needs_information: 0, unconfigured: 0 };
    rows.forEach(a => counts[a.ai_review.status]++);
    const filtered = rows.filter(a => status === 'all' || a.ai_review.status === status)
      .sort((a, b) => (b.ai_review.score ?? -1) - (a.ai_review.score ?? -1) ||
        String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id)));
    const start = Math.max(0, Math.min(Math.floor(Math.max(0, Number(offset) || 0) / limit) * limit,
      Math.max(0, Math.ceil(filtered.length / limit) - 1) * limit));
    return { rows: filtered.slice(start, start + limit), counts, total: filtered.length, offset: start };
  }
  function banner(app, escape) {
    const r = app.ai_review || review(app), ai = app.ai_result;
    if(ai?.engine === 'keywords') {
      const agent=ai.agent;
      const agentPanel=agent ? `<section><h4>Applicant review</h4><p>${escape(agent.summary)}</p>${agent.concerns.length?'<ul>'+agent.concerns.map(s=>'<li>'+escape(s)+'</li>').join('')+'</ul>':''}
        ${agent.strengths.length?'<p><strong>Evidence found</strong></p><ul>'+agent.strengths.map(s=>'<li>'+escape(s.requirement)+' — '+escape(s.evidence)+'</li>').join('')+'</ul>':''}
        ${agent.semanticHints.length?'<p><strong>Related evidence suggested by local AI — verify before accepting</strong></p><ul>'+agent.semanticHints.map(h=>'<li>'+escape(h.requirement)+' ↔ '+escape(h.evidence)+' ('+escape(String(h.similarity))+'/100 text similarity; no score points added)</li>').join('')+'</ul>':''}
        ${agent.semanticStatus==='unavailable'?'<p>'+escape(agent.semanticError)+'</p>':''}
        ${agent.questions.length?'<p><strong>Suggested follow-up questions</strong></p><ul>'+agent.questions.map(q=>'<li>'+escape(q)+'</li>').join('')+'</ul>':''}</section>` : '';
      const list = ai.details.map(d=>`<li>${escape(d.target)} — ${d.exact ? 'found in: '+escape(d.closest) : d.unknown ? 'profile evidence missing' : 'not found'} (${d.exact?Number(d.weight.toFixed(2)):0}/${Number(d.weight.toFixed(2))} keyword points; ${escape(d.source)})</li>`).join('');
      const checks = ai.checks.map(c=>`<li>${escape(c.label)}: ${escape(c.status)} — ${escape(c.reason)}</li>`).join('');
      return `<div class="app-match-banner ${r.status === 'matched' ? 'high' : 'medium'}" style="display:block"><strong>${escape(r.label)}${r.score===null?'':' — '+r.score+'/100 keyword match'}</strong><p>${escape(r.explanation)}</p>${agentPanel}<details open><summary>Matched and missing keywords</summary><ul>${list}</ul>${checks?'<p>Configured requirements</p><ul>'+checks+'</ul>':''}<p>Simple OR alternatives count as one requirement. Skill criteria use declared skills, not career interests. When explicit criteria exist, job-title and description context contributes at most 20%. Score = matched points ÷ total points × 100. Missing evidence needs review; this is not verified ability. HR makes the hiring decision.</p></details></div>`;
    }
    const reasons = [r.explanation, ...(app.match_result?.reasons || [])];
    if (app.ai_error) reasons.push(app.ai_error);
    const details = (ai?.details || []).map(d => `<li>${escape(d.label)}: ${escape(d.target)} — ${escape(d.missing ? 'not provided; no points' :
      d.exact ? 'reported match (including recognised spelling aliases): ' + d.closest : 'not reported; no points. AI-related evidence to review: ' + d.closest + ' (' + d.similarity + '/100 text similarity)')}</li>`).join('');
    const breakdown = Object.entries(ai?.components || {}).map(([key,c])=>`${key}: ${c.points} / ${c.weight}`).join(' · ');
    const experience = ai?.experience ? `<p>Relevant experience: ${escape(ai.experience.reportedMonths == null ? 'not confirmed for this role' : String(ai.experience.reportedMonths) + ' months')} / ${escape(String(ai.experience.targetMonths))} target months. ${escape(ai.experience.scope || '')}</p>` : '';
    return `<div class="app-match-banner ${r.status === 'matched' ? 'high' : 'medium'}" style="display:block"><strong>${escape(r.label)}${r.score === null ? '' : ' — ' + r.score + '/100 profile fit'}</strong><p>${escape(r.explanation)}</p><p>${escape(breakdown)}</p><details open><summary>Match analysis</summary>${reasons.slice(1).map(x => '<p>' + escape(x) + '</p>').join('')}${details ? '<ul>' + details + '</ul>' : ''}${experience}<p>${ai ? 'Evidence coverage: ' + escape(String(ai.coverage)) + '%. ' : ''}Points follow the job’s configured weights and self-reported evidence. AI text similarity is a review hint, not proof of an unreported skill. HR makes the hiring decision.</p></details></div>`;
  }
  root.LocalApplicantAI = { load, reset, review, page, banner, setHRStatus };
  if (typeof module !== 'undefined') module.exports = root.LocalApplicantAI;
})(typeof window === 'undefined' ? globalThis : window);
