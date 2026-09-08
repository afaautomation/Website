/**
 * Kompetenzen Internal Resume & Application Storage (IndexedDB)
 * Stores binary resume files and candidate application records
 * for internal team review in admin.html.
 */

const DB_NAME = 'Kompetenzen_Internal_DB';
const DB_VERSION = 1;
const STORE_NAME = 'applications';

function openResumeDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this browser'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('email', 'email', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save candidate application with attached resume file
 */
async function saveCandidateApplication(data) {
  try {
    const db = await openResumeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        id: data.id || 'app_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name: data.name || 'Candidate',
        phone: data.phone || '',
        email: data.email || '',
        degree: data.degree || '',
        gradYear: data.gradYear || '',
        isStudent: data.isStudent || 'No',
        courseName: data.courseName || '',
        experience: data.experience || '',
        preferredLocation: data.preferredLocation || '',
        workMode: data.workMode || '',
        skills: data.skills || '',
        jobRole: data.jobRole || 'Quick Apply Candidate',
        company: data.company || 'Kompetenzen',
        resumeFileName: data.resumeFileName || '',
        resumeFileSize: data.resumeFileSize || '',
        resumeFileType: data.resumeFileType || '',
        resumeBlob: data.resumeBlob || null, // Native File / Blob
        createdAt: data.createdAt || new Date().toISOString()
      };

      const putRequest = store.put(record);

      putRequest.onsuccess = () => {
        // Also save lightweight metadata to localStorage for instant counting/sync
        try {
          const metaList = JSON.parse(localStorage.getItem('kompetenzen_applications_meta') || '[]');
          const metaItem = {
            id: record.id,
            name: record.name,
            phone: record.phone,
            email: record.email,
            jobRole: record.jobRole,
            resumeFileName: record.resumeFileName,
            hasResume: !!record.resumeBlob,
            createdAt: record.createdAt
          };
          const existingIdx = metaList.findIndex(m => m.id === record.id);
          if (existingIdx >= 0) {
            metaList[existingIdx] = metaItem;
          } else {
            metaList.unshift(metaItem);
          }
          localStorage.setItem('kompetenzen_applications_meta', JSON.stringify(metaList));
        } catch (e) {}

        resolve(record);
      };

      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (err) {
    console.warn('Failed to save application to IndexedDB:', err);
    throw err;
  }
}

/**
 * Retrieve all candidate applications
 */
async function getAllApplications() {
  try {
    const db = await openResumeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Sort newest first
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to get applications from IndexedDB:', err);
    return [];
  }
}

/**
 * Delete an application
 */
async function deleteApplication(id) {
  try {
    const db = await openResumeDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        try {
          let metaList = JSON.parse(localStorage.getItem('kompetenzen_applications_meta') || '[]');
          metaList = metaList.filter(m => m.id !== id);
          localStorage.setItem('kompetenzen_applications_meta', JSON.stringify(metaList));
        } catch (e) {}
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to delete application from IndexedDB:', err);
    return false;
  }
}

/**
 * Download or View a candidate's stored resume
 */
function downloadOrViewResume(app, previewOnly = false) {
  if (!app.resumeBlob) {
    alert('No resume file attached for this applicant.');
    return;
  }

  const blob = app.resumeBlob instanceof Blob 
    ? app.resumeBlob 
    : new Blob([app.resumeBlob], { type: app.resumeFileType || 'application/pdf' });
  const url = URL.createObjectURL(blob);

  if (previewOnly && (app.resumeFileType === 'application/pdf' || (app.resumeFileName && app.resumeFileName.toLowerCase().endsWith('.pdf')))) {
    window.open(url, '_blank');
  } else {
    const a = document.createElement('a');
    a.href = url;
    const safeName = (app.resumeFileName || `${(app.name || 'Candidate').replace(/\s+/g, '_')}_Resume.pdf`)
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\.\.+/g, '.');
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  }
}
