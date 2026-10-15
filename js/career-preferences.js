/* Career interests are self-reported preferences, not an assessment or ranking. */
(() => {
  const $ = id => document.getElementById(id);
  const unknown = "I don't know yet";
  const areas = window.CareerCatalog.areas;
  const softSkills = [...window.CareerCatalog.softSkills, unknown];
  const levels = [
    ['exploring', 'Exploring', 'I’m curious and still deciding if this is for me.'],
    ['learning', 'Learning', 'I’ve studied or taken a course in it.'],
    ['practising', 'Practising', 'I’ve built or done something real in it, like a project, internship or freelance work.'],
    ['working', 'Working', 'I’ve done this as paid work.'],
    ['leading', 'Leading', 'I’ve owned results in it or guided others.']
  ];
  const offers = [
    ['learn_first', 'Learn-first', 'The right field, lower pay, a strong mentor.'],
    ['earn_first', 'Earn-first', 'Higher pay, a role slightly outside my field.'],
    ['security_first', 'Security-first', 'A stable, well-known company, with any suitable role.'],
    ['growth_first', 'Growth-first', 'A startup with big responsibility but uncertainty.']
  ];
  let offerOrder = [];
  const selected = id => [...$(id).querySelectorAll('input:checked')].map(el => el.value);
  function selectOptions(id, values, placeholder) {
    $(id).replaceChildren(new Option(placeholder, ''), ...values.map(v => new Option(v,v)));
  }
  function checks(id, values, chosen = []) {
    $(id).replaceChildren(...values.map(value => {
      const label = document.createElement('label'); label.className = 'career-check';
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = value; input.checked = chosen.includes(value);
      input.addEventListener('change', () => {
        if (input.checked) $(id).querySelectorAll('input').forEach(other => {
          if (other !== input && (value === unknown || other.value === unknown)) other.checked = false;
        });
        updateCount(id);
      });
      label.append(input, document.createTextNode(value)); return label;
    }));
    updateCount(id);
  }
  function updateCount(id) {
    const values = selected(id);
    $(id + '-summary').textContent = values.length ? values.includes(unknown) ? unknown : `${values.length} skill${values.length === 1 ? '' : 's'} selected` : 'Select skills you already have';
  }
  function radios(id, values, chosen = '') {
    $(id).replaceChildren(...values.map(([value,title,description]) => {
      const label = document.createElement('label'); label.className = 'career-choice';
      const input = document.createElement('input'); input.type = 'radio'; input.name = id; input.value = value; input.checked = chosen === value;
      const text = document.createElement('span'), heading = document.createElement('strong'), detail = document.createElement('span');
      heading.textContent = title; detail.textContent = description; text.append(heading, detail); label.append(input,text); return label;
    }));
  }
  function updateField(chosenSkills = []) {
    const field = $('career-field').value;
    checks('career-skills', (areas[$('career-area').value]?.[field] || []).concat(unknown), chosenSkills);
    $('field-experience-title').textContent = `How would you describe your experience in ${field || 'this field'}?`;
    $('field-offer-title').textContent = `A role in ${field || 'this field'} is offered this month. Which offer would you accept?`;
    $('career-field-questions').hidden = !field;
  }
  function updateArea() {
    selectOptions('career-field', Object.keys(areas[$('career-area').value] || {}), 'Select a field to explore');
    $('career-field').disabled = !$('career-area').value;
    $('career-experience').querySelectorAll('input').forEach(el => el.checked = false);
    $('career-offer').querySelectorAll('input').forEach(el => el.checked = false);
    updateField();
  }
  function shuffledOffers() {
    const order = offers.map(o => o[0]);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }
  window.collectCareerPreferences = () => ({
    area: $('career-area').value, field: $('career-field').value,
    skills: $('career-field').value ? selected('career-skills') : [],
    softSkills: selected('career-soft-skills'),
    experience: $('career-field').value ? selected('career-experience')[0] || '' : '',
    offerPreference: $('career-field').value ? selected('career-offer')[0] || '' : '',
    offerOrder: offerOrder.slice()
  });
  window.restoreCareerPreferences = data => {
    if (!data || typeof data !== 'object') return;
    $('career-area').value = Object.hasOwn(areas, data.area) ? data.area : '';
    updateArea();
    $('career-field').value = Object.hasOwn(areas[$('career-area').value] || {}, data.field) ? data.field : '';
    const safeSkills = values => Array.isArray(values) ? values.includes(unknown) ? [unknown] : values : [];
    updateField(safeSkills(data.skills));
    checks('career-soft-skills', softSkills, safeSkills(data.softSkills));
    if (Array.isArray(data.offerOrder) && data.offerOrder.length === offers.length && new Set(data.offerOrder).size === offers.length && data.offerOrder.every(code => offers.some(o => o[0] === code))) offerOrder = data.offerOrder;
    radios('career-experience', levels, $('career-field').value ? data.experience : '');
    radios('career-offer', offerOrder.map(code => offers.find(o => o[0] === code)), $('career-field').value ? data.offerPreference : '');
  };
  window.initCareerPreferences = () => {
    selectOptions('career-area', Object.keys(areas), 'Select a career area');
    offerOrder = shuffledOffers();
    radios('career-experience', levels);
    radios('career-offer', offerOrder.map(code => offers.find(o => o[0] === code)));
    checks('career-soft-skills', softSkills);
    updateArea();
    $('career-area').addEventListener('change', updateArea);
    $('career-field').addEventListener('change', () => {
      $('career-experience').querySelectorAll('input').forEach(el => el.checked = false);
      $('career-offer').querySelectorAll('input').forEach(el => el.checked = false);
      updateField();
    });
  };
})();
