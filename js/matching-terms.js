(function (root) {
  'use strict';
  const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  // Spelling aliases only. Different qualifications, disciplines and skills remain distinct.
  const groups = {
    qualification: [
      ['BSc', 'B.Sc', 'B.Sc.', 'B Sc', 'Bachelor of Science'],
      ['BTech', 'B.Tech', 'B.Tech.', 'B Tech', 'Bachelor of Technology'],
      ['BCA', 'B.C.A', 'B.C.A.', 'Bachelor of Computer Applications'],
      ['MSc', 'M.Sc', 'M.Sc.', 'M Sc', 'Master of Science'],
      ['MTech', 'M.Tech', 'M.Tech.', 'M Tech', 'Master of Technology'],
      ['MCA', 'M.C.A', 'M.C.A.', 'Master of Computer Applications']
    ],
    specialisation: [
      ['Computer Science', 'CS'], ['Artificial Intelligence', 'AI'],
      ['Artificial Intelligence and Machine Learning', 'Artificial Intelligence & Machine Learning', 'AI & ML', 'AI and ML', 'AI/ML', 'AIML']
    ],
    skills: [['JavaScript', 'JS'], ['PostgreSQL', 'Postgres'], ['Excel', 'Microsoft Excel'], ['Power BI', 'PowerBI']],
    softSkills: [['Problem-solving', 'Problem solving'], ['Teamwork', 'Team work'], ['Time management', 'Time-management']]
  };
  // Free-text job keywords may describe skills, subjects or career fields.
  // Keep these aliases separate from strict qualification/eligibility checks.
  groups.keywords = [...groups.skills, ...groups.softSkills, ...groups.specialisation, ...groups.qualification,
    ['Machine Learning', 'ML'], ['Natural Language Processing', 'NLP'],
    ['Human Resources', 'HR'], ['Search Engine Optimization', 'Search Engine Optimisation', 'SEO'],
    ['Computer Aided Design', 'Computer-Aided Design', 'CAD'],
    ['Customer Relationship Management', 'CRM'], ['Quality Assurance', 'QA']];
  function canonical(value, kind) {
    const text = normalize(value);
    const group = (groups[kind] || []).find(g => g.some(x => normalize(x) === text));
    return group ? normalize(group[0]) : text;
  }
  function expand(values, kind) {
    const result = [];
    for (const value of values || []) {
      const group = (groups[kind] || []).find(g => g.some(x => normalize(x) === normalize(value)));
      result.push(...(group || [value]).map(normalize));
    }
    return [...new Set(result.filter(Boolean))];
  }
  function compact(values, kind) {
    return [...new Set((values || []).map(v => canonical(v, kind)).filter(Boolean))];
  }
  root.MatchingTerms = { canonical, expand, compact };
  if (typeof module !== 'undefined') module.exports = root.MatchingTerms;
})(typeof window === 'undefined' ? globalThis : window);
