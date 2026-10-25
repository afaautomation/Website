import './matching-terms.js';
import './career-catalog.js';
import { collectApplicants, makePlan, requirementChecks, resolveRules } from './local-ai-core.mjs';
import { agentReview } from './applicant-agent.mjs';
import { createAgentReviewer } from './applicant-agent-client.mjs';

const { canonical, expand } = globalThis.MatchingTerms;
const stop = new Set(('a an the and or of in on at to for with by from as is are be been being will would should can must have has had we our you your us they their this that these those it its into through across within per ' +
  'job jobs role roles candidate candidates applicant applicants vacancy hiring wanted seeking looking join team company organisation organization work working workplace opportunity opportunities ' +
  'required requirement requirements preferred preference essential desirable knowledge ability able strong good excellent basic advanced proven relevant experience experienced fresher freshers internship intern trainee junior senior ' +
  'year years month months day days hour hours full part time permanent contract remote hybrid onsite salary pay benefits competitive apply application applications responsibilities responsibility include includes including skills skill qualification qualifications degree diploma bachelor bachelors master masters ' +
  'no not only without needed necessary age aged gender male female man woman men women religion religious caste race racial ethnic ethnicity nationality citizen citizenship married unmarried marital disability disabled pregnant pregnancy young old sex sexual orientation date birth college university school prestigious prestige').split(/\s+/));
const text = value => typeof value === 'string' ? value.slice(0,20000).replace(/<[^>]*>/g,' ').replace(/&(?:amp|nbsp);/g,' ').replace(/&#?\w+;/g,' ') : '';
const tokens = value => (text(value).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}+#.]*|\.net/gu) || []).map(t=>t.replace(/\.+$/,'')).filter(Boolean);
const norm = value => tokens(value).join(' ');
const known = value => typeof value === 'string' && value.trim() && !/^i don[’']t know yet$/i.test(value.trim());
const list = value => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\n|]/) : []).filter(known).map(v=>v.trim());
const contains = (value,target) => {
  const term=tokens(target);
  if(!term.length) return false;
  return text(value).replace(/\b(?:haven't|hasn't|don't|doesn't|can't)\b/gi,'not').split(/(?:[.!?](?=\s|$)|[;\n]|\bbut\b|\bhowever\b)/i).some(segment=>{
    const words=tokens(segment);
    return words.some((_,i)=>term.every((t,j)=>words[i+j]===t) &&
    !/\b(no|never|without|not(?! only\b)|unable)\b/.test(words.slice(Math.max(0,i-6),i).join(' ')) &&
    !/^(?:(?:is|are) )?(?:not (?:required|needed|necessary|known)|no experience)/.test(words.slice(i+term.length,i+term.length+4).join(' ')));
  });
};
const dictionary = [...new Set([...Object.values(globalThis.CareerCatalog.areas).flatMap(a=>Object.values(a).flat()), ...globalThis.CareerCatalog.softSkills])];

// No fixed list of supported occupations: unknown domain terms remain keywords.
export function jobKeywords(job, rules = {}) {
  const entries = new Map();
  const add = (target,weight,source,alternatives=[target],kind='keywords') => {
    if(!norm(target) || !tokens(target).some(t=>!stop.has(t) && !/^\d+$/.test(t))) return;
    const key = alternatives.map(v=>canonical(v,kind)).sort().join('|');
    const old = entries.get(key);
    if(!old || old.weight < weight) entries.set(key,{target,alternatives,kind,weight,source});
  };
  for(const c of makePlan(rules)) add(c.target,Math.max(3,c.importance*3),c.label,c.alternatives || [c.target],c.kind);
  // Parse simple alternatives as one requirement. AND/commas remain separate.
  const alternatives = (value,weight,source) => text(value).split(/(?:[.!?](?=\s|$)|[;\n])/).map(clause=>{
    return clause.split(/\s+and\s+|,/i).map(segment=>{
      if(!/\s+or\s+/i.test(segment)) return segment;
      // Preserve words inside skill names: "Time management", "Attention to
      // detail" and "Machine Learning" are not boilerplate or future intent.
      const options=segment.split(/\s+or\s+/i).map(s=>norm(s.trim()
        .replace(/^(?:either\s+)?(?:(?:experience|knowledge|proficiency|skills|familiarity)\s+(?:in|of|with)\s+)?/i,'')
        .replace(/\s+(?:(?:is|are)\s+)?(?:required|preferred|essential|desirable)$/i,'')));
      if(options.length<2 || options.some(s=>!s || tokens(s).length>5) || /\b(no|not|never|without|willing|want to learn|plan to learn)\b/i.test(segment)) return segment;
      add(options.join(' OR '),weight,source,options);return '';
    }).join(', ');
  }).join('; ');
  for(const skill of list(alternatives(job.skills,4,'Listed skill'))) add(skill,4,'Listed skill');
  for(const [source,value,weight] of [['Job title',job.title,1],['Requirements',job.requirements,2],['Responsibilities',job.responsibilities,1],['Description',job.description,1]]) {
    const remaining=alternatives(value,weight+1,source);
    const phrases = dictionary.filter(term=>contains(remaining,term));
    for(const term of phrases) add(term,weight+1,source);
    const covered = new Set(phrases.flatMap(tokens));
    for(const token of new Set(tokens(remaining))) {
      if(stop.has(token) || covered.has(token) || /^\d+$/.test(token) || token.length<2 || !contains(remaining,token)) continue;
      add(token,weight,source);
    }
  }
  const result=[...entries.values()].sort((a,b)=>b.weight-a.weight || a.target.localeCompare(b.target)).slice(0,150);
  const context = k=>['Job title','Description','Responsibilities'].includes(k.source);
  const coreWeight=result.filter(k=>!context(k)).reduce((n,k)=>n+k.weight,0);
  const contextWeight=result.filter(context).reduce((n,k)=>n+k.weight,0);
  // Context can contribute at most 20% when explicit criteria are available.
  if(coreWeight && contextWeight>coreWeight/4) for(const k of result.filter(context)) k.weight=k.weight*coreWeight/(4*contextWeight);
  return result;
}

export function professionalEvidence(app) {
  const e = app.matching_evidence || {}, c=e.career || {};
  // Legacy snapshots use null for fields they never collected. An explicit
  // empty array or "I don't know yet" is an answer and must not revive old data.
  const skills = c.skills != null ? list(c.skills) : list(e.skills ?? app.skills);
  const degree = text(e.qualification ?? app.degree).split(/\s*[·|]\s*/).map(v=>v.trim());
  const specialisation = e.specialisation ?? app.course_name ?? (degree.slice(1).join(' · ') || undefined);
  return { ...e, career:{...c,skills,softSkills:list(c.softSkills)},
    qualification:degree[0] || undefined, specialisation };
}

export function keywordScore(job, app, rules = job.applicationRequirements?.matching || job.application_requirements?.matching || {}, keywords = jobKeywords(job,rules)) {
  const evidence=professionalEvidence(app), c=evidence.career;
  const values=[...c.skills,...c.softSkills,evidence.qualification,evidence.specialisation,c.area,c.field].filter(known);
  const details=keywords.map(k=>{
    const aliases=k.alternatives.flatMap(t=>expand([t],k.kind));
    const candidates=(k.kind==='qualification' ? [evidence.qualification] : k.kind==='specialisation' ? [evidence.specialisation] :
      k.kind==='careerArea' ? [c.area] : k.kind==='careerField' ? [c.field] :
      k.source==='Job title' ? values : [...c.skills,...c.softSkills]).filter(known);
    const closest=candidates.find(v=>aliases.some(t=>contains(v,t) || canonical(v,k.kind)===canonical(t,k.kind)));
    return {...k,label:k.source,exact:!!closest,closest:closest || null,missing:!closest,unknown:!candidates.length,credit:closest?1:0};
  });
  const total=details.reduce((n,d)=>n+d.weight,0), earned=details.reduce((n,d)=>n+d.weight*d.credit,0);
  const missingEvidence=details.filter(d=>d.unknown && !['Job title','Description','Responsibilities'].includes(d.source));
  return {engine:'keywords',version:3,score:total?Math.round(earned/total*1000)/10:null,
    details,checks:requirementChecks(rules,evidence),eligibilityChecked:true,hasEvidence:values.length>0,
    missingEvidence:missingEvidence.map(d=>d.target),
    components:{keywords:{points:total?Math.round(earned/total*1000)/10:0,weight:100}},
    matchedKeywords:details.filter(d=>d.exact).map(d=>d.target),missingKeywords:details.filter(d=>!d.exact).map(d=>d.target),
    coverage:details.length?Math.round(details.filter(d=>d.exact).length/details.length*100):0,reviewRequired:true};
}

// Session-scoped, shared across job views. Sign-out discards data and pending work.
export function createAutomaticReview({semanticReviewer = typeof Worker === 'undefined' ? null : createAgentReviewer()} = {}) {
  let generation=0;
  const jobs=new Map();
  function reset(){generation++;jobs.clear();semanticReviewer?.reset();}
  function load({key,job,fetchPage,onProgress=()=>{}}) {
    if(jobs.has(key)) return jobs.get(key);
    const run=generation, current=()=>run===generation;
    const pending=(async()=>{
      const rows=await collectApplicants(fetchPage,current);
      const rules=resolveRules(rows,job.applicationRequirements?.matching || job.application_requirements?.matching || {});
      const keywords=jobKeywords(job,rules), output=[];
      for(let i=0;i<rows.length;i++){
        if(!current()) throw Error('Review cancelled');
        const ai_result=keywordScore(job,rows[i],rules,keywords);
        ai_result.agent=agentReview(job,ai_result,professionalEvidence(rows[i]));
        output.push({...rows[i],ai_result});
        if(i%50===49) {onProgress(`Scoring ${i+1} of ${rows.length} applicants…`);await new Promise(resolve=>setTimeout(resolve,0));}
      }
      if(!current()) throw Error('Review cancelled');
      // Semantic suggestions are additional evidence to inspect, never score bonuses.
      const items=output.map((row,id)=>({id,skills:[...professionalEvidence(row).career.skills,...professionalEvidence(row).career.softSkills],
        criteria:row.ai_result.details.filter(d=>!d.exact && !['qualification','specialisation','careerArea','careerField'].includes(d.kind) && d.source!=='Job title')
          .slice(0,30).map(d=>({target:d.target,alternatives:d.alternatives}))})).filter(i=>i.skills.length && i.criteria.length);
      if(semanticReviewer && items.length) {
        try {
          const reviews=await semanticReviewer.review(items,onProgress);
          if(!current())throw Error('Review cancelled');
          if(reviews.length!==items.length || new Set(reviews.map(r=>r.id)).size!==items.length || items.some(i=>!reviews.some(r=>r.id===i.id)))throw Error('Incomplete AI review');
          for(const r of reviews)Object.assign(output[r.id].ai_result.agent,{semanticStatus:'complete',semanticHints:r.hints});
        } catch(error) {
          if(!current())throw error;
          for(const i of items)Object.assign(output[i.id].ai_result.agent,{semanticStatus:'unavailable',semanticError:'Local AI comparison unavailable. The evidence-based score is still shown.'});
        }
      }
      if(!current())throw Error('Review cancelled');
      return output;
    })();
    jobs.set(key,pending);
    pending.catch(()=>{if(current() && jobs.get(key)===pending)jobs.delete(key);});
    return pending;
  }
  function setHRStatus(id,status) {
    const run=generation;
    for(const pending of jobs.values()) pending.then(rows=>{
      if(run!==generation)return;
      const row=rows.find(a=>String(a.id)===String(id));if(row)row.hr_status=status;
    }).catch(()=>{});
  }
  return {load,reset,setHRStatus};
}
