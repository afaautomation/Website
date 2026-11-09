/* Shared published content. Browser caches are never the publishing authority. */
window.siteContent = {
  async read(key, fallback) {
    if (!isSupabaseConfigured()) return fallback;
    const { data, error } = await supabaseClient.from('site_content').select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    return data ? data.value : fallback;
  },
  async save(key, value) {
    if (!isSupabaseConfigured()) throw new Error('Database connection is unavailable.');
    const { error } = await supabaseClient.from('site_content').upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    localStorage.setItem(key, JSON.stringify(value));
  }
};
function hasWebPhoto(photo) {
  try { return ['http:', 'https:'].includes(new URL(String(photo || ''), location.href).protocol) && !!photo; } catch { return false; }
}
document.addEventListener('DOMContentLoaded', async () => {
  const courses = { 'course-details.html': 'python', 'java-course-details.html': 'java', 'data-analytics-course-details.html': 'analytics', 'hr-course-details.html': 'hr', 'sales-engineering-course-details.html': 'sales' };
  // Hosts serve clean URLs (/course-details), so add the extension back before the lookup.
  const course = courses[location.pathname.split('/').pop().replace(/\.html$/, '') + '.html'];
  // "Next Batch" text on any page: <strong data-batch-date="python">, keyed like the marketing console.
  const batchSlots = document.querySelectorAll('[data-batch-date]');
  if (!course && !batchSlots.length) return;
  try {
    const [dates, students] = await Promise.all([siteContent.read('kompetenzen_batch_dates', {}), course ? siteContent.read('kompetenzen_placed_students', []) : []]);
    batchSlots.forEach(slot => { const date = dates[slot.dataset.batchDate]; if (date) slot.textContent = date; });
    const container = document.getElementById('placed-students-container');
    // The section stays hidden until the marketing console publishes a student with an uploaded photo;
    // entries left on the default placeholder photo are not shown.
    const matches = students.filter(s => s.course === course && s.photoPath && hasWebPhoto(s.photo));
    const section = document.getElementById('placed-students-section');
    if (container && matches.length) {
      container.replaceChildren();
      for (const student of matches) {
        const card = document.createElement('div'); card.className = 'student-card';
        const photo = document.createElement('img'); photo.className = 'student-photo'; photo.alt = student.name;
        photo.loading = 'lazy'; photo.decoding = 'async'; photo.src = new URL(student.photo, location.href).href;
        card.append(photo);
        for (const [tag, className, value] of [['h4','student-name',student.name],['div','student-role',student.role],['span','student-company',student.company],['div','student-badge',student.badge || 'Placed Candidate']]) {
          const el = document.createElement(tag); el.className = className; el.textContent = value; card.append(el);
        }
        container.append(card);
      }
      if (section) section.hidden = false;
    }
  } catch (error) { console.warn('Published course content could not be loaded:', error); }
});
