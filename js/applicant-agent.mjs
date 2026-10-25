import { cosine } from './local-ai-core.mjs';

const clean = v => typeof v === 'string' ? v.trim().slice(0,200) : '';
const negative = v => /\b(?:no|not|never|without|unable|haven't|don't|can't)\b/i.test(v);

// Inputs are professional evidence only. This model produces review leads,
// never invented skills, qualification equivalence, scores or hiring decisions.
export async function semanticReview(items, embed) {
  const results=[];
  for(const item of items) {
    const candidates=[...new Set((item.skills || []).map(clean).filter(v=>v && !negative(v)))].slice(0,60);
    const hints=[];
    for(const criterion of (item.criteria || []).slice(0,30)) {
      let best=null;
      for(const target of (criterion.alternatives || [criterion.target]).slice(0,8).map(clean).filter(Boolean)) {
        const a=await embed(target);
        for(const candidate of candidates) {
          const similarity=Math.round(cosine(a,await embed(candidate))*1000)/10;
          if(similarity>=50 && (!best || similarity>best.similarity)) best={requirement:clean(criterion.target),evidence:candidate,similarity};
        }
      }
      if(best) hints.push(best);
    }
    results.push({id:item.id,hints:hints.sort((a,b)=>b.similarity-a.similarity).slice(0,5)});
  }
  return results;
}

export function agentReview(job,result,evidence) {
  const skills=[...(evidence.career?.skills || []),...(evidence.career?.softSkills || [])];
  const concerns=[],questions=[];
  const positive=skills.filter(s=>!negative(s));
  for(const value of skills.filter(negative)) {
    const words=value.toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu,' ');
    for(const claim of positive) if((' '+words+' ').includes(' '+claim.toLowerCase()+' ')) {
      concerns.push(`Conflicting skill statements: “${claim}” and “${value}”.`);
      questions.push(`Clarify your current experience with ${claim}.`);
    }
  }
  const explicit=result.details.filter(d=>!['Job title','Description','Responsibilities'].includes(d.source));
  if(!explicit.length) concerns.push('This job has no explicit skill or academic criteria; title similarity alone is insufficient for a match recommendation.');
  for(const check of result.checks.filter(c=>c.status==='missing')) questions.push(`Please provide evidence for ${check.label}: ${check.required}.`);
  for(const term of result.missingEvidence || []) questions.push(`What experience or project demonstrates ${term}?`);
  const gaps=explicit.filter(d=>!d.exact).map(d=>d.target);
  if(!questions.length && gaps.length) questions.push(`Can you provide examples demonstrating ${gaps.slice(0,3).join(', ')}?`);
  return {
    version:1,steps:['Read job criteria','Compare declared evidence','Check essential requirements','Identify uncertainty','Prepare HR review'],
    strengths:explicit.filter(d=>d.exact).map(d=>({requirement:d.target,evidence:d.closest})).slice(0,8),
    gaps:gaps.slice(0,8),concerns:[...new Set(concerns)],questions:[...new Set(questions)].slice(0,5),
    reviewNeeded:concerns.length>0,semanticStatus:'not_run',semanticHints:[],
    summary:concerns.length ? 'Human review needed before using the score.' : result.missingEvidence?.length ? 'More profile evidence is needed.' : 'Evidence comparison complete; review the strengths and gaps below.'
  };
}
