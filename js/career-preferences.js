/* Career interests are self-reported preferences, not an assessment or ranking. */
(() => {
  const $ = id => document.getElementById(id);
  const unknown = "I don't know yet";
  const areas = window.CareerCatalog.areas;
  const softSkills = [...window.CareerCatalog.softSkills, unknown];
  const offers = [
    ['learn_first', 'Learn-first', 'The right field, lower pay, a strong mentor.'],
    ['earn_first', 'Earn-first', 'Higher pay, a role slightly outside my field.'],
    ['security_first', 'Security-first', 'A stable, well-known company, with any suitable role.'],
    ['growth_first', 'Growth-first', 'A startup with big responsibility but uncertainty.']
  ];
  let offerOrder = [];
  const STAR_LEVELS = ['Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert'];
  const selected = id => $(id) ? [...$(id).querySelectorAll('input:checked')].map(el => el.value) : [];
  // Self-rated level (1-5 stars) for each ticked skill that has one: { "SQL": 3, ... }
  const ratings = id => {
    const out = {};
    if ($(id)) $(id).querySelectorAll('.career-check').forEach(row => {
      const rating = Number(row.dataset.rating) || 0;
      if (rating && row.querySelector('input').checked) out[row.querySelector('input').value] = rating;
    });
    return out;
  };
  function selectOptions(id, values, placeholder) {
    if (!$(id)) return;
    $(id).replaceChildren(new Option(placeholder, ''), ...values.map(v => new Option(v,v)));
  }
  // Paints a row's stars from its rating; unticked rows lose their rating.
  function paintStars(row) {
    const input = row.querySelector('input');
    if (!input.checked) row.dataset.rating = '0';
    const rating = Number(row.dataset.rating) || 0;
    row.querySelectorAll('.career-star').forEach((star, i) => {
      star.classList.toggle('is-on', i < rating);
      star.setAttribute('aria-checked', String(i + 1 === rating));
      star.tabIndex = (rating ? i + 1 === rating : i === 0) ? 0 : -1;
    });
    const level = row.querySelector('.career-star-level');
    if (level) level.textContent = rating ? STAR_LEVELS[rating - 1] : '';
  }
  function stars(id, row, value) {
    const group = document.createElement('div'); group.className = 'career-stars';
    group.setAttribute('role', 'radiogroup'); group.setAttribute('aria-label', `Your level in ${value}`);
    const setRating = (n, focus) => {
      const input = row.querySelector('input');
      if (!input.checked) { input.checked = true; input.dispatchEvent(new Event('change')); }
      row.dataset.rating = String(n); paintStars(row);
      if (focus) group.children[n - 1].focus();
    };
    for (let n = 1; n <= 5; n++) {
      const star = document.createElement('button'); star.type = 'button'; star.className = 'career-star';
      star.setAttribute('role', 'radio'); star.setAttribute('aria-label', `${n} of 5 – ${STAR_LEVELS[n - 1]}`);
      star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
      star.addEventListener('click', () => setRating(n, false));
      star.addEventListener('keydown', e => {
        const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (step) { e.preventDefault(); setRating(Math.min(5, Math.max(1, (Number(row.dataset.rating) || 0) + step)), true); }
        else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); setRating(e.key === 'Home' ? 1 : 5, true); }
      });
      group.append(star);
    }
    return group;
  }
  function check(id, value, checked, rating = 0) {
    const row = document.createElement('div'); row.className = 'career-check';
    row.dataset.rating = String(checked && rating >= 1 && rating <= 5 ? Math.round(rating) : 0);
    const label = document.createElement('label'); label.className = 'career-check-label';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = value; input.checked = checked;
    const name = document.createElement('span'); name.className = 'career-check-name'; name.textContent = value;
    input.addEventListener('change', () => {
      if (input.checked && $(id)) $(id).querySelectorAll('input').forEach(other => {
        if (other !== input && (value === unknown || other.value === unknown)) other.checked = false;
      });
      if ($(id)) $(id).querySelectorAll('.career-check').forEach(paintStars);
      updateCount(id);
    });
    label.append(input, name); row.append(label);
    if (value !== unknown) {
      const level = document.createElement('span'); level.className = 'career-star-level'; level.setAttribute('aria-hidden', 'true');
      row.append(stars(id, row, value), level);
    }
    paintStars(row);
    return row;
  }
  function checks(id, values, chosen = [], chosenRatings = {}) {
    if (!$(id)) return;
    // Skills the candidate typed in earlier are kept as extra options, ahead of "I don't know yet".
    const custom = chosen.filter(v => typeof v === 'string' && v.trim() && !values.includes(v));
    const all = values.includes(unknown) ? [...values.filter(v => v !== unknown), ...custom, unknown] : [...values, ...custom];
    $(id).replaceChildren(...all.map(value => check(id, value, chosen.includes(value), Number(chosenRatings[value]) || 0)));
    updateCount(id);
  }
  function addSkill(id, raw) {
    const value = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!value || value.toLowerCase() === unknown.toLowerCase() || !$(id)) return false;
    const inputs = [...$(id).querySelectorAll('input')];
    const existing = inputs.find(el => el.value.toLowerCase() === value.toLowerCase());
    const target = existing || check(id, value, false).querySelector('input');
    if (!existing) {
      const unknownRow = inputs.find(el => el.value === unknown)?.closest('.career-check');
      $(id).insertBefore(target.closest('.career-check'), unknownRow || null);
    }
    if (!target.checked) { target.checked = true; target.dispatchEvent(new Event('change')); }
    return true;
  }
  function addSkillControl(id, placeholder) {
    if (!$(id)) return;
    const row = document.createElement('div'); row.className = 'career-add-skill';
    const input = document.createElement('input'); input.type = 'text'; input.className = 'form-input-box'; input.maxLength = 60;
    input.placeholder = placeholder; input.setAttribute('aria-label', placeholder);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'career-add-skill-btn'; button.textContent = '+ Add';
    const submit = () => { if (addSkill(id, input.value)) input.value = ''; input.focus(); };
    button.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    row.append(input, button);
    $(id).after(row);
  }
  function updateCount(id) {
    if (!$(id) || !$(id + '-summary')) return;
    const values = selected(id);
    $(id + '-summary').textContent = values.length ? values.includes(unknown) ? unknown : `${values.length} skill${values.length === 1 ? '' : 's'} selected` : 'Select skills you already have';
  }
  function radios(id, values, chosen = '') {
    if (!$(id)) return;
    $(id).replaceChildren(...values.map(([value,title,description]) => {
      const label = document.createElement('label'); label.className = 'career-choice';
      const input = document.createElement('input'); input.type = 'radio'; input.name = id; input.value = value; input.checked = chosen === value;
      const text = document.createElement('span'), heading = document.createElement('strong'), detail = document.createElement('span');
      heading.textContent = title; detail.textContent = description; text.append(heading, detail); label.append(input,text); return label;
    }));
  }
  function updateField(chosenSkills = [], chosenRatings = {}) {
    const field = $('career-field')?.value || '';
    checks('career-skills', (areas[$('career-area')?.value]?.[field] || []).concat(unknown), chosenSkills, chosenRatings);
    if ($('field-offer-title')) $('field-offer-title').textContent = `A role in ${field || 'this field'} is offered this month. Which offer would you accept?`;
    if ($('career-field-questions')) $('career-field-questions').hidden = !field;
  }
  function updateArea() {
    selectOptions('career-field', Object.keys(areas[$('career-area')?.value] || {}), 'Select a field to explore');
    if ($('career-field')) $('career-field').disabled = !$('career-area')?.value;
    if ($('career-offer')) $('career-offer').querySelectorAll('input').forEach(el => el.checked = false);
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
    area: $('career-area') ? $('career-area').value : '',
    field: $('career-field') ? $('career-field').value : '',
    skills: $('career-field')?.value ? selected('career-skills') : [],
    softSkills: selected('career-soft-skills'),
    skillRatings: $('career-field')?.value ? ratings('career-skills') : {},
    softSkillRatings: ratings('career-soft-skills'),
    offerPreference: $('career-field')?.value && $('career-offer') ? selected('career-offer')[0] || '' : '',
    offerOrder: offerOrder.slice()
  });
  window.restoreCareerPreferences = data => {
    if (!data || typeof data !== 'object') return;
    if ($('career-area')) $('career-area').value = Object.hasOwn(areas, data.area) ? data.area : '';
    updateArea();
    if ($('career-field')) $('career-field').value = Object.hasOwn(areas[$('career-area')?.value] || {}, data.field) ? data.field : '';
    const safeSkills = values => Array.isArray(values) ? values.includes(unknown) ? [unknown] : values : [];
    const safeRatings = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    updateField(safeSkills(data.skills), safeRatings(data.skillRatings));
    checks('career-soft-skills', softSkills, safeSkills(data.softSkills), safeRatings(data.softSkillRatings));
    if ($('career-offer')) {
      if (Array.isArray(data.offerOrder) && data.offerOrder.length === offers.length && new Set(data.offerOrder).size === offers.length && data.offerOrder.every(code => offers.some(o => o[0] === code))) offerOrder = data.offerOrder;
      radios('career-offer', offerOrder.map(code => offers.find(o => o[0] === code)), $('career-field')?.value ? data.offerPreference : '');
    }
  };
  window.initCareerPreferences = () => {
    selectOptions('career-area', Object.keys(areas), 'Select a career area');
    if ($('career-offer')) {
      offerOrder = shuffledOffers();
      radios('career-offer', offerOrder.map(code => offers.find(o => o[0] === code)));
    }
    checks('career-soft-skills', softSkills);
    addSkillControl('career-skills', 'Add more skills, e.g. TensorFlow');
    addSkillControl('career-soft-skills', 'Add more soft skills, e.g. Negotiation');
    updateArea();
    $('career-area')?.addEventListener('change', updateArea);
    $('career-field')?.addEventListener('change', () => {
      if ($('career-offer')) $('career-offer').querySelectorAll('input').forEach(el => el.checked = false);
      updateField();
    });
  };
})();
