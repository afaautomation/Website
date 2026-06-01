/**
 * ResumePro Frontend Logic
 * Refactored for Anonymous Flow: Home -> Templates -> Editor
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:5000/api`
    : `https://resume-builder-api-9k75.onrender.com/api`;

// --- State Management ---
const state = {
    resumes: [],
    currentResume: null,
    activeView: 'landing', // 'landing', 'templates', 'editor'
    isSaving: false
};

// --- API Helpers ---
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    const token = localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.message || 'API Error');
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}

// --- Navigation & View Logic ---
function switchView(viewName) {
    state.activeView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.remove('hidden');
        window.scrollTo(0, 0);
    }

    if (viewName === 'templates') fetchTemplatesForPicker();
    
    // Update background state if it exists
    if (window.updateBackgroundView) {
        window.updateBackgroundView(viewName);
    }
}

// --- Template Picker Logic ---
async function fetchTemplatesForPicker() {
    const grid = document.getElementById('template-picker-grid');
    if (!grid) return;

    const renderTemplates = (templates) => {
        grid.innerHTML = templates.map(t => `
            <div class="template-card" onclick="startBuildingWithTemplate('${t.id}')">
                <div class="template-thumb">
                    ${t.thumbnail_url ? `<img src="${t.thumbnail_url}" alt="${t.name}">` : '<!-- Placeholder -->'}
                </div>
                <div class="template-info">
                    <h4>${t.name}</h4>
                    <p>${t.description || 'Professional & ATS-friendly'}</p>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    };

    // Load from cache first for instant UI
    const cached = localStorage.getItem('cached_templates');
    if (cached) {
        try { renderTemplates(JSON.parse(cached)); } catch(e){}
    } else {
        grid.innerHTML = '<div style="text-align: center; width: 100%; grid-column: 1 / -1; padding: 4rem;"><i data-lucide="loader" style="animation: spin 1s linear infinite; margin-bottom: 1rem;"></i><p style="color: var(--text-muted);">Waking up the server... Please wait a few seconds!</p></div>';
        lucide.createIcons();
    }

    try {
        const data = await apiFetch('/templates');
        if (data && data.templates) {
            localStorage.setItem('cached_templates', JSON.stringify(data.templates));
            renderTemplates(data.templates);
        }
    } catch (err) {
        console.error('Failed to load templates', err);
        if (!cached) {
            grid.innerHTML = '<div style="text-align: center; width: 100%; grid-column: 1 / -1; padding: 2rem; color: #ef4444;">Failed to load templates. Please refresh and try again.</div>';
        }
    }
}

async function startBuildingWithTemplate(templateId) {
    try {
        showToast('Preparing your editor...', 'success');
        const data = await apiFetch('/resumes', {
            method: 'POST',
            body: JSON.stringify({ 
                title: 'My New Resume',
                templateId: templateId
            })
        });
        openEditor(data.resume.id);
    } catch (err) {
        console.error(err);
    }
}

window.startBuildingWithTemplate = startBuildingWithTemplate;

// --- Editor Logic ---
async function openEditor(id) {
    try {
        const data = await apiFetch(`/resumes/${id}`);
        state.currentResume = data.resume;
        switchView('editor');
        setupEditor();
        
        // Initialize Design Inputs
        if (state.currentResume.design) {
            if (state.currentResume.design.primaryColor) {
                document.getElementById('design-primary-color').value = state.currentResume.design.primaryColor;
            }
            if (state.currentResume.design.fontFamily) {
                document.getElementById('design-font-family').value = state.currentResume.design.fontFamily;
            }
        }
        
        updatePreview();
    } catch (err) {
        console.error(err);
    }
}

function setupEditor() {
    const r = state.currentResume;
    document.getElementById('resume-title-input').value = r.title;
    
    const sections = [
        { key: 'contact', label: 'Contact Info', icon: 'user' },
        { key: 'summary', label: 'Summary', icon: 'align-left' },
        { key: 'experience', label: 'Experience', icon: 'briefcase' },
        { key: 'education', label: 'Education', icon: 'graduation-cap' },
        { key: 'skills', label: 'Skills', icon: 'code' },
        { key: 'projects', label: 'Projects', icon: 'folder' },
        { key: 'certifications', label: 'Certifications', icon: 'award' },
        { key: 'additional', label: 'Additional Info', icon: 'info' },
        { key: 'languages', label: 'Languages', icon: 'languages' },
        { key: 'references', label: 'References', icon: 'users' },
        { key: 'design', label: 'Design', icon: 'palette' }
    ];

    const sectionContainer = document.getElementById('editor-sections');
    sectionContainer.innerHTML = sections.map(s => `
        <button class="section-nav-btn" data-section="${s.key}" draggable="true">
            <i data-lucide="${s.icon}" class="drag-handle"></i>
            <span>${s.label}</span>
        </button>
    `).join('');
    lucide.createIcons();

    sectionContainer.querySelectorAll('.section-nav-btn').forEach(btn => {
        btn.onclick = () => renderSectionForm(btn.dataset.section);
        
        btn.addEventListener('dragstart', (e) => {
            btn.classList.add('dragging');
            e.dataTransfer.setData('text/plain', btn.dataset.section);
        });

        btn.addEventListener('dragend', () => {
            btn.classList.remove('dragging');
            updateSectionsOrder();
        });
    });

    sectionContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(sectionContainer, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (afterElement == null) {
            sectionContainer.appendChild(dragging);
        } else {
            sectionContainer.insertBefore(dragging, afterElement);
        }
    });

    renderSectionForm('contact');
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.section-nav-btn:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function updateSectionsOrder() {
    const newOrder = [...document.querySelectorAll('.section-nav-btn')].map(btn => btn.dataset.section);
    state.currentResume.layout = { sections: newOrder };
    
    // Save order
    saveResumeDebounced();
    
    // Update preview (templates will need to support this)
    updatePreview();
}

function renderSectionForm(sectionKey) {
    const formContainer = document.getElementById('active-section-form');
    const content = state.currentResume.content;
    
    document.querySelectorAll('.section-nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.section === sectionKey);
    });

    if (sectionKey === 'contact') {
        formContainer.innerHTML = `
            <h2>Contact Information</h2>
            <div class="form-grid">
                <div class="input-group">
                    <label>Full Name</label>
                    <input type="text" data-path="contact.name" value="${content.contact?.name || ''}">
                </div>
                <div class="input-group">
                    <label>Email</label>
                    <input type="email" data-path="contact.email" value="${content.contact?.email || ''}">
                </div>
                <div class="input-group">
                    <label>Phone</label>
                    <input type="text" data-path="contact.phone" value="${content.contact?.phone || ''}">
                </div>
                <div class="input-group">
                    <label>Location</label>
                    <input type="text" data-path="contact.location" value="${content.contact?.location || ''}">
                </div>
                <div class="input-group">
                    <label>LinkedIn ID / URL</label>
                    <input type="text" data-path="contact.linkedin" value="${content.contact?.linkedin || ''}">
                </div>
                <div class="input-group">
                    <label>GitHub ID / URL</label>
                    <input type="text" data-path="contact.github" value="${content.contact?.github || ''}">
                </div>
            </div>
        `;
    } else if (sectionKey === 'summary') {
        formContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
                <h2 style="margin-bottom:0;">Professional Summary</h2>
                <button class="secondary-btn sm ai-suggest-btn" data-type="summary"><i data-lucide="sparkles"></i> AI Write</button>
            </div>
            <div class="input-group full">
                <textarea id="summary-textarea" data-path="summary" rows="12" placeholder="Briefly describe your professional background and key achievements...">${content.summary || ''}</textarea>
            </div>
        `;
    } else if (['experience', 'education', 'projects', 'certifications', 'additional', 'languages', 'references'].includes(sectionKey)) {
        const items = content[sectionKey] || [];
        formContainer.innerHTML = `
            <div class="section-header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <h2>${sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}</h2>
                <button class="primary-btn sm" id="add-item-btn"><i data-lucide="plus"></i> Add Entry</button>
            </div>
            <div id="list-container" class="list-editor-container" style="display:flex; flex-direction:column; gap:1.5rem;">
                ${items.map((item, idx) => renderListItem(sectionKey, item, idx)).join('')}
            </div>
        `;
        document.getElementById('add-item-btn').onclick = () => addListItem(sectionKey);
    } else if (sectionKey === 'skills') {
        const skills = content.skills || [];
        formContainer.innerHTML = `
            <div class="section-header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <h2>Skills & Expertise</h2>
                <button class="primary-btn sm" id="add-skill-btn"><i data-lucide="plus"></i> Add Skill</button>
            </div>
            <div id="skills-container" style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                ${skills.map((skill, idx) => `
                    <div class="skill-item" style="display:flex; gap:0.5rem; background:var(--bg-main); padding:0.5rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
                        <input type="text" data-section="skills" data-index="${idx}" value="${skill}" style="flex:1; background:transparent; border:none; color:white;">
                        <button class="icon-btn sm" onclick="removeSkill(${idx})"><i data-lucide="x"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
        document.getElementById('add-skill-btn').onclick = () => {
            if (!state.currentResume.content.skills) state.currentResume.content.skills = [];
            state.currentResume.content.skills.push('');
            renderSectionForm('skills');
            saveResume();
        };

        // Special handling for skill inputs
        formContainer.querySelectorAll('input').forEach(input => {
            input.oninput = debounce(() => {
                const idx = parseInt(input.dataset.index);
                state.currentResume.content.skills[idx] = input.value;
                saveResume();
            }, 500);
        });
    } else if (sectionKey === 'design') {
        const design = state.currentResume.design || {};
        formContainer.innerHTML = `
            <h2>Design & Templates</h2>
            <div style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem; color: var(--text-muted); font-size: 1rem;">Customization</h3>
                <div class="form-grid">
                    <div class="input-group">
                        <label>Primary Color</label>
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <input type="color" data-path="design.primaryColor" value="${design.primaryColor || '#2563eb'}" style="width: 40px; height: 40px; padding: 0; background: none; border: none; cursor: pointer;">
                            <span style="color:var(--text-muted); font-size:0.9rem;">Choose theme color</span>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Font Family</label>
                        <select data-path="design.fontFamily" style="background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.75rem; color: white;">
                            <option value="Inter, sans-serif" ${design.fontFamily === 'Inter, sans-serif' ? 'selected' : ''}>Inter (Modern Sans)</option>
                            <option value="Merriweather, serif" ${design.fontFamily === 'Merriweather, serif' ? 'selected' : ''}>Merriweather (Classic Serif)</option>
                            <option value="Roboto, sans-serif" ${design.fontFamily === 'Roboto, sans-serif' ? 'selected' : ''}>Roboto (Clean Sans)</option>
                            <option value="Playfair Display, serif" ${design.fontFamily === 'Playfair Display, serif' ? 'selected' : ''}>Playfair Display (Elegant)</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Font Size (pt)</label>
                        <input type="number" data-path="design.fontSize" value="${design.fontSize || 10}" min="8" max="14" step="0.5">
                    </div>
                    <div class="input-group">
                        <label>Line Height</label>
                        <input type="number" data-path="design.lineHeight" value="${design.lineHeight || 1.4}" min="1" max="2" step="0.1">
                    </div>
                    <div class="input-group">
                        <label>Page Margin (mm)</label>
                        <input type="number" id="margin-input" value="${design.margins?.top || 12.7}" min="5" max="30" step="1">
                    </div>
                </div>
            </div>
            <h3 style="margin-bottom: 1rem; color: var(--text-muted); font-size: 1rem;">Change Template</h3>
            <div id="template-editor-list" class="template-grid" style="grid-template-columns: 1fr 1fr; gap: 1rem;">
                <!-- Internal template switcher -->
            </div>
        `;
        
        const marginInput = document.getElementById('margin-input');
        if (marginInput) {
            marginInput.oninput = debounce(() => {
                const m = parseFloat(marginInput.value);
                state.currentResume.design.margins = { top: m, right: m, bottom: m, left: m };
                saveResume();
            }, 500);
        }

        fetchTemplatesForEditor();
    }

    // Attach AI Suggestion handlers
    formContainer.querySelectorAll('.ai-suggest-btn').forEach(btn => {
        btn.onclick = async () => {
            const type = btn.dataset.type;
            const section = btn.dataset.section;
            const index = btn.dataset.index;
            let context = state.currentResume.content;
            
            if (type === 'description' && section && index !== undefined) {
                context = state.currentResume.content[section][parseInt(index)];
            }
            
            showToast('Generating detailed AI suggestion...', 'info');
            btn.innerHTML = '<i data-lucide="loader"></i>';
            lucide.createIcons();

            const targetId = type === 'summary' ? 'summary-textarea' : `${section}-desc-${index}`;
            const textarea = document.getElementById(targetId);
            if (textarea) textarea.value = ''; // Clear for fresh suggestion

            try {
                const response = await fetch(`${API_BASE}/ai/suggest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, context, stream: true })
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.replace(/^data: /, '').trim();
                            if (dataStr === '[DONE]') continue;
                            try {
                                const data = JSON.parse(dataStr);
                                if (data.chunk) {
                                    fullText += data.chunk;
                                    if (textarea) {
                                        textarea.value = fullText;
                                        // Auto-scroll to bottom
                                        textarea.scrollTop = textarea.scrollHeight;
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                }
                
                if (type === 'summary') {
                    state.currentResume.content.summary = fullText;
                } else if (type === 'description') {
                    state.currentResume.content[section][parseInt(index)].description = fullText;
                }
                saveResume();
                showToast('AI suggestion applied!', 'success');
            } catch (err) {
                console.error(err);
                showToast('Failed to generate suggestion.', 'error');
            } finally {
                btn.innerHTML = type === 'summary' ? '<i data-lucide="sparkles"></i> AI Write' : '<i data-lucide="sparkles" style="width:16px; height:16px; color:var(--primary);"></i>';
                lucide.createIcons();
            }
        };
    });

    // Attach auto-save
    formContainer.querySelectorAll('input, textarea, select').forEach(input => {
        input.oninput = debounce(() => {
            const path = input.dataset.path;
            const value = input.value;
            const index = input.dataset.index;
            const section = input.dataset.section;
            
            if (section === 'skills' && index !== undefined) {
                state.currentResume.content.skills[parseInt(index)] = value;
            } else if (index !== undefined) {
                state.currentResume.content[section][parseInt(index)][path] = value;
            } else if (path) {
                if (path.startsWith('design.')) {
                    const key = path.split('.')[1];
                    if (!state.currentResume.design) state.currentResume.design = {};
                    state.currentResume.design[key] = input.type === 'number' ? parseFloat(value) : value;
                } else if (path.includes('.')) {
                    const [obj, key] = path.split('.');
                    if (!state.currentResume.content[obj]) state.currentResume.content[obj] = {};
                    state.currentResume.content[obj][key] = value;
                } else {
                    state.currentResume.content[path] = value;
                }
            }
            
            saveResume();
        }, 500);
    });

    lucide.createIcons();
}

function renderListItem(section, item, index) {
    if (section === 'experience') {
        return `
            <div class="list-item-card" style="background:var(--bg-main); padding:1.5rem; border-radius:var(--radius-md); border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                    <span style="color:var(--primary); font-weight:600;">Experience #${index + 1}</span>
                    <button class="icon-btn" onclick="removeListItem('experience', ${index})"><i data-lucide="trash-2"></i></button>
                </div>
                <div class="form-grid">
                    <div class="input-group"><label>Company</label><input type="text" data-section="experience" data-index="${index}" data-path="company" value="${item.company || ''}"></div>
                    <div class="input-group"><label>Title</label><input type="text" data-section="experience" data-index="${index}" data-path="title" value="${item.title || ''}"></div>
                    <div class="input-group"><label>Start Date</label><input type="text" data-section="experience" data-index="${index}" data-path="startDate" value="${item.startDate || ''}"></div>
                    <div class="input-group"><label>End Date</label><input type="text" data-section="experience" data-index="${index}" data-path="endDate" value="${item.endDate || ''}"></div>
                    <div class="input-group full">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label>Description</label>
                            <button type="button" class="icon-btn ai-suggest-btn sm" data-type="description" data-section="experience" data-index="${index}" title="AI Suggestion"><i data-lucide="sparkles" style="width:16px; height:16px; color:var(--primary);"></i></button>
                        </div>
                        <textarea id="experience-desc-${index}" data-section="experience" data-index="${index}" data-path="description" rows="4">${item.description || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
    } else if (section === 'education') {
        return `
            <div class="list-item-card" style="background:var(--bg-main); padding:1.5rem; border-radius:var(--radius-md); border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                    <span style="color:var(--primary); font-weight:600;">Education #${index + 1}</span>
                    <button class="icon-btn" onclick="removeListItem('education', ${index})"><i data-lucide="trash-2"></i></button>
                </div>
                <div class="form-grid">
                    <div class="input-group"><label>Institution</label><input type="text" data-section="education" data-index="${index}" data-path="institution" value="${item.institution || ''}"></div>
                    <div class="input-group"><label>Degree</label><input type="text" data-section="education" data-index="${index}" data-path="degree" value="${item.degree || ''}"></div>
                    <div class="input-group full"><label>End Date / Year</label><input type="text" data-section="education" data-index="${index}" data-path="endDate" value="${item.endDate || ''}"></div>
                </div>
            </div>
        `;
    } else if (section === 'projects') {
        return `
            <div class="list-item-card" style="background:var(--bg-main); padding:1.5rem; border-radius:var(--radius-md); border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                    <span style="color:var(--primary); font-weight:600;">Project #${index + 1}</span>
                    <button class="icon-btn" onclick="removeListItem('projects', ${index})"><i data-lucide="trash-2"></i></button>
                </div>
                <div class="form-grid">
                    <div class="input-group full"><label>Project Name</label><input type="text" data-section="projects" data-index="${index}" data-path="name" value="${item.name || ''}"></div>
                    <div class="input-group full">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <label>Description</label>
                            <button type="button" class="icon-btn ai-suggest-btn sm" data-type="description" data-section="projects" data-index="${index}" title="AI Suggestion"><i data-lucide="sparkles" style="width:16px; height:16px; color:var(--primary);"></i></button>
                        </div>
                        <textarea id="projects-desc-${index}" data-section="projects" data-index="${index}" data-path="description" rows="4">${item.description || ''}</textarea>
                    </div>
                    <div class="input-group full"><label>Link (Optional)</label><input type="text" data-section="projects" data-index="${index}" data-path="link" value="${item.link || ''}"></div>
                </div>
            </div>
        `;
    } else if (section === 'certifications') {
        return `
            <div class="list-item-card" style="background:var(--bg-main); padding:1.5rem; border-radius:var(--radius-md); border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                    <span style="color:var(--primary); font-weight:600;">Certification #${index + 1}</span>
                    <button class="icon-btn" onclick="removeListItem('certifications', ${index})"><i data-lucide="trash-2"></i></button>
                </div>
                <div class="form-grid">
                    <div class="input-group full"><label>Name</label><input type="text" data-section="certifications" data-index="${index}" data-path="name" value="${item.name || ''}"></div>
                    <div class="input-group"><label>Issuer</label><input type="text" data-section="certifications" data-index="${index}" data-path="issuer" value="${item.issuer || ''}"></div>
                    <div class="input-group"><label>Date</label><input type="text" data-section="certifications" data-index="${index}" data-path="date" value="${item.date || ''}"></div>
                </div>
            </div>
        `;
    } else if (section === 'additional') {
        return `
            <div class="list-item-card" style="background:var(--bg-main); padding:1.5rem; border-radius:var(--radius-md); border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                    <span style="color:var(--primary); font-weight:600;">Entry #${index + 1}</span>
                    <button class="icon-btn" onclick="removeListItem('additional', ${index})"><i data-lucide="trash-2"></i></button>
                </div>
                <div class="form-grid">
                    <div class="input-group full"><label>Title (e.g. Languages)</label><input type="text" data-section="additional" data-index="${index}" data-path="title" value="${item.title || ''}"></div>
                    <div class="input-group full"><label>Description / Details</label><textarea data-section="additional" data-index="${index}" data-path="value" rows="2">${item.value || ''}</textarea></div>
                </div>
            </div>
        `;
    } else if (section === 'languages') {
        return `
            <div class="list-item-card" style="background:var(--bg-main); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border); display:flex; gap:1rem; align-items:center;">
                <input type="text" data-section="languages" data-index="${index}" data-path="name" placeholder="Language (e.g. English)" value="${item.name || ''}" style="flex:1;">
                <select data-section="languages" data-index="${index}" data-path="level" style="width:150px;">
                    <option value="Native" ${item.level === 'Native' ? 'selected' : ''}>Native</option>
                    <option value="Fluent" ${item.level === 'Fluent' ? 'selected' : ''}>Fluent</option>
                    <option value="Professional" ${item.level === 'Professional' ? 'selected' : ''}>Professional</option>
                    <option value="Intermediate" ${item.level === 'Intermediate' ? 'selected' : ''}>Intermediate</option>
                    <option value="Basic" ${item.level === 'Basic' ? 'selected' : ''}>Basic</option>
                </select>
                <button class="icon-btn" onclick="removeListItem('languages', ${index})"><i data-lucide="trash-2"></i></button>
            </div>
        `;
    } else if (section === 'references') {
        return `
            <div class="list-item-card" style="background:var(--bg-main); padding:1.5rem; border-radius:var(--radius-md); border:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                    <span style="color:var(--primary); font-weight:600;">Reference #${index + 1}</span>
                    <button class="icon-btn" onclick="removeListItem('references', ${index})"><i data-lucide="trash-2"></i></button>
                </div>
                <div class="form-grid">
                    <div class="input-group"><label>Name</label><input type="text" data-section="references" data-index="${index}" data-path="name" value="${item.name || ''}"></div>
                    <div class="input-group"><label>Position/Company</label><input type="text" data-section="references" data-index="${index}" data-path="title" value="${item.title || ''}"></div>
                    <div class="input-group full"><label>Contact Info (Email/Phone)</label><input type="text" data-section="references" data-index="${index}" data-path="contact" value="${item.contact || ''}"></div>
                </div>
            </div>
        `;
    }
    return '';
}

function addListItem(section) {
    if (!state.currentResume.content[section]) state.currentResume.content[section] = [];
    state.currentResume.content[section].push({});
    renderSectionForm(section);
    saveResume();
}

window.removeListItem = (section, index) => {
    state.currentResume.content[section].splice(index, 1);
    renderSectionForm(section);
    saveResume();
};

window.removeSkill = (index) => {
    state.currentResume.content.skills.splice(index, 1);
    renderSectionForm('skills');
    saveResume();
};

async function fetchTemplatesForEditor() {
    const list = document.getElementById('template-editor-list');
    if (!list) return;

    const renderTemplates = (templates) => {
        list.innerHTML = templates.map(t => `
            <div class="template-card ${state.currentResume.template_id === t.id ? 'selected' : ''}" 
                 onclick="switchTemplate('${t.id}')"
                 style="cursor:pointer; overflow:hidden; border:1px solid ${state.currentResume.template_id === t.id ? 'var(--primary)' : 'var(--border)'};">
                <div class="template-thumb" style="height:120px; background:var(--bg-main); overflow:hidden;">
                    ${t.thumbnail_url ? `<img src="${t.thumbnail_url}" style="width:100%; height:100%; object-fit:cover;">` : ''}
                </div>
                <div class="template-info" style="padding:0.5rem;">
                    <h4 style="font-size:0.85rem; margin:0;">${t.name}</h4>
                </div>
            </div>
        `).join('');
    };

    const cached = localStorage.getItem('cached_templates');
    if (cached) {
        try { renderTemplates(JSON.parse(cached)); } catch(e){}
    } else {
        list.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;"><i data-lucide="loader" style="animation: spin 1s linear infinite;"></i></div>';
        lucide.createIcons();
    }

    try {
        const data = await apiFetch('/templates');
        if (data && data.templates) {
            localStorage.setItem('cached_templates', JSON.stringify(data.templates));
            renderTemplates(data.templates);
        }
    } catch (err) {
        console.error('Failed to load templates for editor', err);
    }
}

window.switchTemplate = async (templateId) => {
    try {
        await apiFetch(`/resumes/${state.currentResume.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ templateId })
        });
        state.currentResume.template_id = templateId;
        renderSectionForm('design');
        updatePreview();
        showToast('Template switched!');
    } catch (err) {}
};

async function saveResume() {
    document.querySelector('.save-status').innerHTML = 'Saving...';
    try {
        await apiFetch(`/resumes/${state.currentResume.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                content: state.currentResume.content,
                design: state.currentResume.design,
                title: document.getElementById('resume-title-input').value
            })
        });
        document.querySelector('.save-status').innerHTML = '<i data-lucide="check"></i> Saved';
        lucide.createIcons();
        updatePreview();
    } catch (err) {
        document.querySelector('.save-status').innerHTML = 'Error saving';
    }
}

function updatePreview() {
    const iframe = document.getElementById('resume-preview-iframe');
    iframe.src = `${API_BASE}/export/${state.currentResume.id}/preview?t=${Date.now()}`;
}

// --- Utils ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Eagerly wake up the backend to prevent cold start delays
    fetch(`${API_BASE}/templates`).catch(() => {});
    
    lucide.createIcons();

    // Auth Modal Logic
    function requireAuth(callback) {
        if (localStorage.getItem('token')) {
            callback();
        } else {
            document.getElementById('auth-modal').classList.remove('hidden');
            // Store callback to run after successful login
            window._pendingAuthCallback = callback;
        }
    }

    // Auth Tabs
    document.querySelectorAll('#auth-modal .modal-tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#auth-modal .modal-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('auth-login-pane').classList.add('hidden');
            document.getElementById('auth-register-pane').classList.add('hidden');
            document.getElementById(btn.dataset.tab + '-pane').classList.remove('hidden');
        };
    });

    // Auth Forms
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            // [DEMO MODE] Bypass backend login
            localStorage.setItem('token', 'demo-token-123');
            document.getElementById('auth-modal').classList.add('hidden');
            if (window._pendingAuthCallback) {
                window._pendingAuthCallback();
                window._pendingAuthCallback = null;
            } else {
                switchView('templates');
            }
        } catch (err) { showToast('Login failed. Check your credentials.', 'error'); }
    };

    document.getElementById('register-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            // [DEMO MODE] Bypass backend register
            localStorage.setItem('token', 'demo-token-123');
            document.getElementById('auth-modal').classList.add('hidden');
            if (window._pendingAuthCallback) {
                window._pendingAuthCallback();
                window._pendingAuthCallback = null;
            } else {
                switchView('templates');
            }
        } catch (err) { showToast('Registration failed.', 'error'); }
    };

    // Nav Actions
    document.getElementById('start-building-btn').onclick = () => requireAuth(() => switchView('templates'));
    document.getElementById('hero-cta-btn').onclick = () => requireAuth(() => switchView('templates'));
    document.getElementById('back-to-home').onclick = () => switchView('landing');
    document.getElementById('back-to-templates').onclick = () => switchView('templates');

    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.classList.add('hidden');
        });
    });

    // Editor Actions
    document.getElementById('download-pdf-btn').onclick = () => {
        window.open(`${API_BASE}/export/${state.currentResume.id}/pdf`);
    };

    const mobileBottomBtn = document.getElementById('mobile-bottom-download-btn');
    if (mobileBottomBtn) {
        mobileBottomBtn.onclick = () => {
            window.open(`${API_BASE}/export/${state.currentResume.id}/pdf`);
        };
    }


    document.getElementById('ats-check-btn').onclick = async () => {
        // Open sidebar ATS tab
        document.querySelector('[data-panel="analysis-panel"]').click();

        const data = await apiFetch(`/resumes/${state.currentResume.id}/ats`);
        
        // Update Sidebar
        document.getElementById('sidebar-ats-percentage').innerText = `${data.ats.score}%`;
        const sidebarFeedback = document.getElementById('sidebar-ats-feedback');
        sidebarFeedback.innerHTML = data.ats.topImprovements.map(imp => `<p>💡 ${imp}</p>`).join('');
        
        showToast('ATS analysis updated in sidebar!', 'success');
    };

    // Sidebar Tabs Logic
    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
        btn.onclick = () => {
            const panel = btn.dataset.panel;
            document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.sidebar-panels .panel').forEach(p => p.classList.remove('active'));
            document.getElementById(panel).classList.add('active');
        };
    });

    // Sidebar AI Scan
    document.getElementById('sidebar-ai-scan-btn').onclick = async () => {
        const btn = document.getElementById('sidebar-ai-scan-btn');
        const jdInput = document.getElementById('ats-jd-input').value.trim();
        const jobTitleInput = document.getElementById('ats-job-title-input').value.trim();
        btn.innerHTML = '<i data-lucide="loader"></i> Analysis...';
        lucide.createIcons();
        try {
            const result = await apiFetch('/ai/scan', {
                method: 'POST',
                body: JSON.stringify({ resumeData: state.currentResume.content, useAi: true, jobDescription: jdInput, targetJob: jobTitleInput })
            });
            document.getElementById('sidebar-ats-percentage').innerText = `${result.data.aiScore || result.data.score}%`;
            const sidebarFeedback = document.getElementById('sidebar-ats-feedback');
            sidebarFeedback.innerHTML = (result.data.topImprovements || []).map(imp => `<p>✨ ${imp}</p>`).join('');
            showToast('AI Deep Scan completed!', 'success');
        } catch (err) {
            showToast('AI Scan failed.', 'error');
        } finally {
            btn.innerHTML = '<i data-lucide="sparkles"></i> AI Deep Scan';
            lucide.createIcons();
        }
    };

    // Design Customizer Actions
    const primaryColorInput = document.getElementById('design-primary-color');
    const fontFamilySelect = document.getElementById('design-font-family');

    primaryColorInput.oninput = () => updateDesignSetting('primaryColor', primaryColorInput.value);
    fontFamilySelect.onchange = () => updateDesignSetting('fontFamily', fontFamilySelect.value);
});

async function updateDesignSetting(key, value) {
    if (!state.currentResume) return;
    
    if (!state.currentResume.design) state.currentResume.design = {};
    state.currentResume.design[key] = value;
    
    // Immediate preview update
    updatePreview();
    
    // Debounced save
    saveResumeDebounced();
}

const saveResumeDebounced = debounce(async () => {
    if (!state.currentResume) return;
    try {
        await apiFetch(`/resumes/${state.currentResume.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: state.currentResume.title,
                content: state.currentResume.content,
                design: state.currentResume.design
            })
        });
        document.getElementById('save-status').innerText = 'All changes saved';
    } catch (err) {
        console.error('Failed to save design settings', err);
    }
}, 1000);
