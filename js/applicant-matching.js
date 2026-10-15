(function (root) {
  'use strict';
  const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const list = value => [...new Set(String(value || '').split(',').map(norm).filter(Boolean))];
  function parse(values) {
    const parseSkills = text => String(text || '').split('\n').filter(x => x.trim()).map(line => {
      const [name, requirement, importance, ...extra] = line.split('|').map(x => x.trim());
      if (!name || !['essential', 'preferred'].includes(requirement) || !Number.isFinite(Number(importance)) || Number(importance) <= 0 || Number(importance) > 100 || extra.length) {
        throw new Error('Use one skill per line: Python | essential | 3. Importance must be greater than 0 and at most 100.');
      }
      return { name: norm(name), essential: requirement === 'essential', importance: Number(importance) };
    });
    const skills = parseSkills(values.skills), softSkills = parseSkills(values.softSkills);
    if (skills.length + softSkills.length > 30) throw new Error('Use at most 30 technical and soft skill requirements combined.');
    if (softSkills.length > 30 || new Set(softSkills.map(s => s.name)).size !== softSkills.length) throw new Error('Use unique soft skills.');
    if (values.careerField && !values.careerArea) throw new Error('Select a career interest for the field.');
    if (skills.length > 30 || new Set(skills.map(s => s.name)).size !== skills.length) throw new Error('Use up to 30 unique skills.');
    const weights = Object.fromEntries(['skills', 'academics', 'experience'].map(k => [k, Number(values[k + 'Weight'])]));
    if (Object.values(weights).some(n => !Number.isInteger(n) || n < 0) || Object.values(weights).reduce((a, b) => a + b, 0) !== 100) throw new Error('Ranking weights must be non-negative whole numbers and total 100.');
    const minimum = Number(values.minimum || 0), preferred = Number(values.preferred || 0);
    if (![minimum, preferred].every(n => Number.isInteger(n) && n >= 0 && n <= 600)) throw new Error('Experience must be 0–600 whole months.');
    if ((minimum || preferred) && !String(values.experienceScope || '').trim()) throw new Error('Describe the relevant experience and accepted types (for example Python projects, internships and employment).');
    const rules = { version: 2, source: 'career_preferences', careerArea: values.careerArea || '', careerField: values.careerField || '', skills, softSkills, weights,
      qualifications: list(values.qualifications), specialisations: list(values.specialisations),
      preferredQualifications: list(values.preferredQualifications), preferredSpecialisations: list(values.preferredSpecialisations),
      minimumMonths: minimum, preferredMonths: preferred, experienceScope: String(values.experienceScope || '').trim() };
    if (!rules.careerArea && !rules.careerField && !softSkills.length && !skills.length && !rules.qualifications.length && !rules.specialisations.length && !minimum && !preferred && !rules.preferredQualifications.length && !rules.preferredSpecialisations.length) throw new Error('Configure at least one matching criterion.');
    return rules;
  }
  // [key, label, input type, hint, placeholder]
  const sections = [
    { title: 'Academics', subtitle: 'Required groups must both pass. Preferred groups share the academic points.', fields: [
      ['qualifications', 'Required qualifications', 'text', 'Any one listed alternative is accepted.', 'e.g. BCA, BTech, BSc Computer Science'],
      ['specialisations', 'Required specialisations', 'text', 'Exact names, comma-separated.', 'e.g. Computer Science, IT'],
      ['preferredQualifications', 'Preferred qualifications', 'text', 'Earn academic points when matched.', 'e.g. MCA, MTech'],
      ['preferredSpecialisations', 'Preferred specialisations', 'text', 'Earn academic points when matched.', 'e.g. Data Science, AI']
    ] },
    { title: 'Experience', subtitle: 'Points increase until the target is reached.', fields: [
      ['experienceScope', 'What counts as relevant experience', 'text', 'Field, activities and accepted types.', 'e.g. Python projects, internships or employment', true],
      ['minimum', 'Minimum required (months)', 'number', '0 = no minimum. Candidates below it are rejected.'],
      ['preferred', 'Target for full points (months)', 'number', '0 = no preference.']
    ] },
    { title: 'Ranking weights', subtitle: 'How eligible candidates are scored. Weights must total 100.', weights: true, fields: [
      ['skillsWeight', 'Skills', 'number'], ['academicsWeight', 'Academics', 'number'], ['experienceWeight', 'Experience', 'number']
    ] }
  ];
  let mountCount = 0;
  function mount(container, rules) {
    const r = rules || {};
    const uid = 'mc' + (++mountCount);
    const values = { ...r, minimum: r.minimumMonths || 0, preferred: r.preferredMonths || 0, skillsWeight: r.weights?.skills ?? 70, academicsWeight: r.weights?.academics ?? 20, experienceWeight: r.weights?.experience ?? 10 };
    const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
    container.classList.add('mc');
    container.replaceChildren();

    const howto = el('details', 'mc-howto');
    howto.append(el('summary', '', 'How screening and ranking work'));
    const steps = el('ol');
    ['Eligibility is checked first: career interest, field, essential skills, required academics and minimum experience must all pass.',
      'Eligible candidates are ranked by the weights below. Weights with no active criteria move to skills, then academics, then experience.',
      'With no ranking criteria, everyone scores equally. Experience stage and career priority are never used.'
    ].forEach(text => steps.append(el('li', '', text)));
    howto.append(steps);
    container.append(howto);

    function section(title, subtitle) {
      const box = el('section', 'mc-section');
      const head = el('header', 'mc-section-head');
      const text = el('div');
      text.append(el('h4', 'mc-section-title', title));
      if (subtitle) text.append(el('p', 'mc-section-sub', subtitle));
      head.append(text); box.append(head); container.append(box);
      return { box, head };
    }
    function field(parent, key, label, hint, wide) {
      const wrap = el('div', 'field mc-field' + (wide ? ' mc-wide' : ''));
      const lab = el('label', '', label); lab.htmlFor = uid + '-' + key;
      wrap.append(lab); parent.append(wrap);
      return input => { input.id = lab.htmlFor; input.dataset.matchField = key; wrap.append(input); if (hint) wrap.append(el('p', 'field-hint', hint)); };
    }

    const catalog = root.CareerCatalog || { areas: {}, softSkills: [] };
    const selectors = {};
    const target = section('Role targeting', 'Only candidates whose career preferences match are eligible.');
    const targetGrid = el('div', 'mc-grid'); target.box.append(targetGrid);
    for (const [key, label] of [['careerArea', 'Career interest'], ['careerField', 'Field']]) {
      const select = document.createElement('select'); selectors[key] = select;
      field(targetGrid, key, label, 'Essential when selected.')(select);
    }
    function options(select, items, value) {
      select.replaceChildren(new Option('Any / not required', ''), ...items.map(x => new Option(x, x)));
      select.value = value || '';
    }
    options(selectors.careerArea, Object.keys(catalog.areas), r.careerArea);
    options(selectors.careerField, Object.keys(catalog.areas[selectors.careerArea.value] || {}), r.careerField);

    const skillGroups = {};
    function updateCount(key) {
      const g = skillGroups[key]; if (!g) return;
      const n = g.list.querySelectorAll('input[type="checkbox"]:checked').length;
      g.count.textContent = n ? n + ' selected' : 'None selected';
      g.count.classList.toggle('is-active', n > 0);
    }
    function skillRows(key, selected = []) {
      const g = skillGroups[key]; if (!g) return;
      const available = key === 'softSkills' ? catalog.softSkills : (catalog.areas[selectors.careerArea.value]?.[selectors.careerField.value] || []);
      g.list.replaceChildren();
      const names = [...new Set([...available, ...selected.map(s => s.name)])].filter((name, index, all) => all.findIndex(x => norm(x) === norm(name)) === index);
      if (!names.length) {
        g.list.append(el('p', 'mc-empty', key === 'skills' ? 'Choose a career interest and field above to see its technical skills.' : 'No soft skills available.'));
      }
      names.forEach(name => {
        const rule = selected.find(s => norm(s.name) === norm(name));
        const row = el('div', 'mc-skill'); row.dataset.skillGroup = key;
        const label = el('label', 'mc-skill-name'), check = document.createElement('input');
        check.type = 'checkbox'; check.value = name; check.checked = !!rule; check.defaultChecked = !!rule;
        label.append(check, el('span', '', name));
        const controls = el('div', 'mc-skill-controls');
        const kind = document.createElement('select'); kind.setAttribute('aria-label', name + ' requirement');
        kind.append(new Option('Preferred', 'preferred'), new Option('Essential', 'essential')); kind.value = rule?.essential ? 'essential' : 'preferred';
        const impWrap = el('label', 'mc-importance'); impWrap.append(el('span', '', 'Importance'));
        const importance = document.createElement('input'); importance.type = 'number'; importance.min = 1; importance.max = 100;
        importance.value = rule?.importance || 1; importance.defaultValue = importance.value; importance.setAttribute('aria-label', name + ' importance');
        impWrap.append(importance);
        controls.append(kind, impWrap);
        const sync = () => {
          row.classList.toggle('is-on', check.checked);
          row.classList.toggle('is-essential', check.checked && kind.value === 'essential');
          kind.disabled = importance.disabled = !check.checked;
        };
        check.addEventListener('change', () => { sync(); updateCount(key); });
        kind.addEventListener('change', sync);
        sync();
        row.append(label, controls); g.list.append(row);
      });
      updateCount(key);
    }
    for (const [key, title] of [['skills', 'Technical skills'], ['softSkills', 'Soft skills']]) {
      const s = section(title, 'Tick the skills that matter, mark each Essential or Preferred, and set importance (1–100). Technical and soft skills share the skills weight.');
      const count = el('span', 'mc-count');
      s.head.append(count);
      const list = el('div', 'mc-skill-grid'); s.box.append(list);
      skillGroups[key] = { list, count };
      skillRows(key, r[key] || []);
    }
    selectors.careerArea.addEventListener('change', () => { options(selectors.careerField, Object.keys(catalog.areas[selectors.careerArea.value] || {})); skillRows('skills'); });
    selectors.careerField.addEventListener('change', () => skillRows('skills'));

    sections.forEach(def => {
      const s = section(def.title, def.subtitle);
      const grid = el('div', 'mc-grid' + (def.weights ? ' mc-grid-3' : '')); s.box.append(grid);
      const weightInputs = [];
      def.fields.forEach(([key, label, type, hint, placeholder, wide]) => {
        const input = document.createElement('input'); input.type = type;
        if (type === 'number') { input.min = '0'; input.max = def.weights ? '100' : '600'; input.step = '1'; }
        if (placeholder) input.placeholder = placeholder;
        input.value = Array.isArray(values[key]) ? values[key].join(', ') : values[key] ?? '';
        input.defaultValue = input.value;
        field(grid, key, label, hint, wide)(input);
        if (def.weights) weightInputs.push(input);
      });
      if (def.weights) {
        const total = el('span', 'mc-count');
        s.head.append(total);
        const update = () => {
          const sum = weightInputs.reduce((a, i) => a + (Number(i.value) || 0), 0);
          total.textContent = 'Total ' + sum + ' / 100';
          total.classList.toggle('is-active', sum === 100);
          total.classList.toggle('is-error', sum !== 100);
        };
        weightInputs.forEach(i => i.addEventListener('input', update));
        update();
      }
    });
  }
  function read(container) {
    const values = Object.fromEntries([...container.querySelectorAll('[data-match-field]')].map(i => [i.dataset.matchField, i.value]));
    for (const key of ['skills','softSkills']) {
      values[key] = [...container.querySelectorAll('[data-skill-group="' + key + '"]')].filter(row => row.querySelector('input[type="checkbox"]').checked).map(row => [row.querySelector('input[type="checkbox"]').value,row.querySelector('select').value,row.querySelector('input[type="number"]').value].join(' | ')).join('\n');
    }
    return parse(values);
  }
  const labels = { matched: 'Matched', needs_information: 'Needs information', not_matched: 'Rejected — essential requirement not met', unconfigured: 'Rules not configured', pending: 'Matching in progress', processing_failed: 'Matching failed' };
  function banner(result, escape) {
    const r = result || { status: 'pending' };
    const components = r.components || {};
    const breakdown = Object.entries(components).map(([key, c]) => `${key}: ${c.points} / ${c.weight}`).join(' · ');
    return `<div class="app-match-banner ${r.status === 'matched' ? 'high' : 'medium'}" style="display:block"><strong>${escape(labels[r.status] || r.status)}${r.status === 'matched' ? ' — ' + escape(String(r.score)) + '% job match' : ''}</strong><div>${escape(breakdown)}</div><details><summary>Why this result?</summary>${(r.reasons || []).map(x => '<div>' + escape(x) + '</div>').join('')}<p>${r.profileUpdatedAt ? 'Uses updated profile information; the original submission is retained.' : 'Uses submitted information.'} Candidate-provided evidence. Score measures configured job fit, not hiring probability. Hiring decisions remain with HR.</p></details></div>`;
  }
  root.ApplicantMatching = { parse, mount, read, banner, labels };
  if (typeof module !== 'undefined') module.exports = root.ApplicantMatching;
})(typeof window === 'undefined' ? globalThis : window);
