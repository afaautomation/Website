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
document.addEventListener('DOMContentLoaded', async () => {
  const courses = { 'course-details.html': 'python', 'java-course-details.html': 'java', 'data-analytics-course-details.html': 'analytics', 'hr-course-details.html': 'hr', 'sales-engineering-course-details.html': 'sales' };
  // Hosts serve clean URLs (/course-details), so add the extension back before the lookup.
  const course = courses[location.pathname.split('/').pop().replace(/\.html$/, '') + '.html'];
  if (!course) return;
  try {
    const [dates, students] = await Promise.all([siteContent.read('kompetenzen_batch_dates', {}), siteContent.read('kompetenzen_placed_students', [])]);
    const batch = document.querySelector('.meta-line span:nth-child(1) strong');
    if (batch && dates[course]) batch.textContent = dates[course];
    const container = document.getElementById('placed-students-container');
    const matches = students.filter(s => s.course === course);
    if (container && matches.length) {
      container.replaceChildren();
      for (const student of matches) {
        const card = document.createElement('div'); card.className = 'student-card';
        const photo = document.createElement('img'); photo.className = 'student-photo'; photo.alt = student.name;
        const url = new URL(student.photo || 'student_python.jpg', location.href);
        if (['http:', 'https:'].includes(url.protocol)) photo.src = url.href;
        card.append(photo);
        for (const [tag, className, value] of [['h4','student-name',student.name],['div','student-role',student.role],['span','student-company',student.company],['div','student-badge',student.badge || 'Placed Candidate']]) {
          const el = document.createElement(tag); el.className = className; el.textContent = value; card.append(el);
        }
        container.append(card);
      }
    }
  } catch (error) { console.warn('Published course content could not be loaded:', error); }
});
