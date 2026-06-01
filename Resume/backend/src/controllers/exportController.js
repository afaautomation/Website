const path = require('path');
const fs = require('fs');
const { getDb } = require('../config/database');
const { generatePdf, normalizeResumeData } = require('../services/pdfService');
const logger = require('../config/logger');

async function downloadPdf(req, res) {
  const { resumeId } = req.params;
  const db = await getDb();
  const userId = req.user ? req.user.id : 'guest_user';

  const resume = await db.get(
    `SELECT r.*, t.html_content, t.css_content 
     FROM resumes r 
     LEFT JOIN templates t ON r.template_id = t.id 
     WHERE r.id = ? AND r.user_id = ?`,
    resumeId, userId
  );

  if (!resume) return res.status(404).json({ success: false, message: 'Resume not found' });

  try {
    const data = {
      content: JSON.parse(resume.content),
      design: JSON.parse(resume.design),
      html: resume.html_content,
      css: resume.css_content
    };

    const pdfBuffer = await generatePdf(data);
    
    // Log export
    await db.run('INSERT INTO exports (id, resume_id, user_id, format, file_path) VALUES (?, ?, ?, ?, ?)',
      require('uuid').v4(), resumeId, userId, 'pdf', 'buffer'
    );

    res.contentType("application/pdf");
    res.setHeader('Content-Disposition', `attachment; filename=resume_${resumeId}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error(`Export error: ${err.message}`);
    res.status(500).json({ success: false, message: 'PDF generation failed' });
  }
}

async function previewResume(req, res) {
  const { resumeId } = req.params;
  const db = await getDb();

  const resume = await db.get(
    `SELECT r.*, t.html_content, t.css_content 
     FROM resumes r 
     LEFT JOIN templates t ON r.template_id = t.id 
     WHERE r.id = ?`,
    resumeId
  );

  if (!resume) return res.status(404).send('Resume not found');
  
  if (!resume.html_content) {
    return res.send(`
      <div style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; color: #64748b; background: #f8fafc; text-align: center; padding: 2rem;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5;"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></svg>
        <h2 style="margin: 0 0 0.5rem 0; color: #1e293b;">No Template Selected</h2>
        <p style="margin: 0;">Please select a template in the design sidebar to preview your resume.</p>
      </div>
    `);
  }

  const content = JSON.parse(resume.content || '{}');
  const design = JSON.parse(resume.design || '{}');
  const { generatePreviewHtml } = require('../services/pdfService');
  
  const previewHtml = generatePreviewHtml(content, design, resume.html_content, resume.css_content);
  res.send(previewHtml);
}

module.exports = { downloadPdf, previewResume };
