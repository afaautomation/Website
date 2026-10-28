/* Dependent fields shared by all three career stages. A page may omit a stage
   (internship-profile.html has no experienced block); missing fields are skipped. */
(() => {
  const get = id => document.getElementById(id);
  const prefixes = ['study', 'grad', 'exp'].filter(p => get(`f-${p}-qualification`));
  const otherIds = ['f-institution', ...prefixes.flatMap(p => [`f-${p}-qualification`, `f-${p}-specialisation`]), 'f-industry', 'f-recent-role'];
  const fieldIds = [...otherIds, 'f-study-semester', 'f-study-year', 'f-grad-year'];
  const options = window.PROFILE_OPTIONS;
  function populate(id, values, placeholder, other = true, preserve = false) {
    const el = get(id), previous = preserve ? el.value : '';
    el.replaceChildren(new Option(placeholder, ''), ...values.map(v => new Option(v, v)));
    if (other) el.add(new Option(id === 'f-institution' ? 'Other / My college is not listed' : 'Other', 'Other'));
    el.value = [...el.options].some(o => o.value === previous) ? previous : '';
    if (!preserve && get(id + '-other')) get(id + '-other').value = '';
    toggleOther(id);
  }
  function toggleOther(id) {
    const el = get(id), wrap = get(id + '-other-wrap'), input = get(id + '-other');
    if (!wrap) return;
    wrap.hidden = el.value !== 'Other';
    input.disabled = wrap.hidden || el.disabled;
    input.setAttribute('aria-required', String(!input.disabled));
    el.setAttribute('aria-expanded', String(!wrap.hidden));
    el.setAttribute('aria-controls', wrap.id);
  }
  function streams(prefix, preserve) {
    const qualification = get(`f-${prefix}-qualification`);
    const course = options.courses.find(c => c[0] === qualification.value);
    const id = `f-${prefix}-specialisation`;
    populate(id, options.streams[course ? course[1] : 'general'], qualification.value ? 'Select specialisation / stream' : 'Select a course first', true, preserve);
    get(id).disabled = qualification.disabled || !qualification.value;
    toggleOther(id);
    if (prefix === 'study') {
      const semesters = Array.from({length: course ? course[2] : 12}, (_,i) => String(i+1));
      populate('f-study-semester', semesters.concat('Annual / Non-semester course'), 'Select current semester', false, preserve);
      get('f-study-semester').disabled = qualification.disabled || !qualification.value;
    }
  }
  function jobs(preserve) {
    const industry = get('f-industry');
    if (!industry) return;
    populate('f-recent-role', options.industries[industry.value] || [], industry.value ? 'Select job title' : 'Select an industry first', true, preserve);
    get('f-recent-role').disabled = industry.disabled || !industry.value;
    toggleOther('f-recent-role');
  }
  let collegeActiveIndex = -1;
  function closeColleges() {
    get('college-options').hidden = true;
    get('college-search').setAttribute('aria-expanded', 'false');
    get('college-search').removeAttribute('aria-activedescendant');
    collegeActiveIndex = -1;
  }
  function chooseCollege(value) {
    get('f-institution').value = value;
    get('college-search').value = value === 'Other' ? 'Other / My college is not listed' : value;
    get('college-search').removeAttribute('aria-invalid');
    get('err-institution').textContent = '';
    toggleOther('f-institution');
    closeColleges();
    get('college-results').textContent = '';
    get('f-institution').dispatchEvent(new Event('change', {bubbles: true}));
    if (value === 'Other') get('f-institution-other').focus();
  }
  function collegeSearch(showAll = false) {
    const query = showAll ? '' : get('college-search').value.trim().toLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    const matches = window.KERALA_COLLEGES.filter(n => words.every(word => n.toLowerCase().includes(word)));
    const list = get('college-options');
    list.replaceChildren(...matches.concat('Other').map((value, index) => {
      const item = document.createElement('div');
      item.id = `college-option-${index}`;
      item.className = 'college-option';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.textContent = value === 'Other' ? 'Other / My college is not listed' : value;
      item.addEventListener('mousedown', e => e.preventDefault());
      item.addEventListener('click', () => chooseCollege(value));
      return item;
    }));
    collegeActiveIndex = -1;
    get('college-search').removeAttribute('aria-activedescendant');
    list.hidden = false;
    get('college-search').setAttribute('aria-expanded', 'true');
    get('college-results').textContent = matches.length ? `${matches.length.toLocaleString()} matches. Select a college or choose Other.` : 'No matching colleges. Choose Other to enter yours.';
  }
  window.profileAnswer = id => get(id).value === 'Other' ? get(id + '-other').value.trim() : get(id).value.trim();
  window.isProfileField = id => fieldIds.includes(id) || otherIds.some(base => id === base + '-other') || id === 'college-search';
  window.syncProfileDependencies = preserve => {
    prefixes.forEach(p => streams(p, preserve));
    jobs(preserve);
    otherIds.forEach(toggleOther);
  };
  function restoreOne(id, value) {
    const el = get(id);
    if (!el || !value) return;
    value = String(value);
    const listed = [...el.options].some(o => o.value === value);
    if (!listed && otherIds.includes(id)) {
      el.value = 'Other';
      get(id + '-other').value = value;
    } else {
      // Keep a saved historical year or semester visible when editing an older profile.
      if (!listed) el.add(new Option(value, value));
      el.value = value;
    }
    toggleOther(id);
  }
  window.restoreProfileFields = fields => {
    restoreOne('f-institution', fields['f-institution']);
    prefixes.forEach(prefix => {
      const id = `f-${prefix}-qualification`;
      restoreOne(id, fields[id]);
      streams(prefix, false);
      restoreOne(`f-${prefix}-specialisation`, fields[`f-${prefix}-specialisation`]);
    });
    restoreOne('f-industry', fields['f-industry']);
    jobs(false);
    restoreOne('f-recent-role', fields['f-recent-role']);
    ['f-study-semester','f-study-year','f-grad-year'].forEach(id => restoreOne(id, fields[id]));
    otherIds.forEach(id => {
      if (Object.hasOwn(fields, id + '-other') && get(id + '-other')) get(id + '-other').value = fields[id + '-other'] || '';
      toggleOther(id);
    });
    const college = get('f-institution').value;
    get('college-search').value = college === 'Other' ? 'Other / My college is not listed' : college || fields['college-search'] || '';
    closeColleges();
  };
  window.initProfileFields = () => {
    prefixes.forEach(prefix => {
      const id = `f-${prefix}-qualification`, el = get(id);
      el.add(new Option(prefix === 'study' ? 'Select your course' : 'Select highest qualification',''));
      for (const group of ['Bachelor’s','Master’s','Other qualifications']) {
        const optgroup = document.createElement('optgroup'); optgroup.label = group;
        options.courses.filter(c => c[3] === group).forEach(c => optgroup.append(new Option(c[0], c[0])));
        el.append(optgroup);
      }
      el.add(new Option('Other','Other'));
      el.addEventListener('change', () => streams(prefix, false));
    });
    if (get('f-industry')) {
      populate('f-industry', Object.keys(options.industries), 'Select your industry');
      get('f-industry').addEventListener('change', () => jobs(false));
    }
    otherIds.forEach(id => get(id)?.addEventListener('change', () => toggleOther(id)));
    populate('f-institution', window.KERALA_COLLEGES, 'Select your college');
    const search = get('college-search');
    search.addEventListener('input', () => {
      get('f-institution').value = '';
      toggleOther('f-institution');
      collegeSearch();
    });
    search.addEventListener('focus', () => collegeSearch(!!get('f-institution').value));
    search.addEventListener('click', () => { if (get('college-options').hidden) collegeSearch(!!get('f-institution').value); });
    search.addEventListener('blur', closeColleges);
    search.addEventListener('keydown', e => {
      const list = get('college-options');
      if (e.key === 'Escape') { e.preventDefault(); closeColleges(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (list.hidden) collegeSearch(!!get('f-institution').value);
        const items = [...list.children];
        collegeActiveIndex = (collegeActiveIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((item, i) => item.setAttribute('aria-selected', String(i === collegeActiveIndex)));
        search.setAttribute('aria-activedescendant', items[collegeActiveIndex].id);
        items[collegeActiveIndex].scrollIntoView({block:'nearest'});
      } else if (e.key === 'Enter' && !list.hidden) {
        e.preventDefault();
        if (collegeActiveIndex >= 0) list.children[collegeActiveIndex].click();
      }
    });
    window.syncProfileDependencies(false);
  };
})();
