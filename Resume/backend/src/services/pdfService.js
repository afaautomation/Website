/**
 * PDF Generation Service
 * Renders a resume to PDF using Puppeteer + Handlebars templates.
 */

const puppeteer = require('puppeteer');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

const PDF_DIR = process.env.PDF_OUTPUT_DIR || path.join(__dirname, '../../exports');
try {
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
} catch (err) {
  logger.warn(`Could not create PDF directory at ${PDF_DIR}: ${err.message}`);
}

// ─── Handlebars Helpers ───────────────────────────────────────────────────────
Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
  switch (operator) {
    case '==': return v1 == v2 ? options.fn(this) : options.inverse(this);
    case '!=': return v1 != v2 ? options.fn(this) : options.inverse(this);
    case '>':  return v1 > v2  ? options.fn(this) : options.inverse(this);
    case '<':  return v1 < v2  ? options.fn(this) : options.inverse(this);
    default:   return options.inverse(this);
  }
});

Handlebars.registerHelper('join', (arr, sep) =>
  Array.isArray(arr) ? arr.join(typeof sep === 'string' ? sep : ', ') : ''
);

Handlebars.registerHelper('nl2br', (text) =>
  new Handlebars.SafeString(
    (text || '').replace(/\n/g, '<br>')
  )
);

// ─── HTML Builder ─────────────────────────────────────────────────────────────

/**
 * Builds a full HTML document from resume data + design settings + template HTML/CSS.
 */
function normalizeResumeData(resumeData) {
  const normalized = { ...resumeData };

  if (Array.isArray(normalized.education)) {
    normalized.education = normalized.education.map((item) => ({
      ...item,
      institution: item.institution || item.school || '',
      endDate: item.endDate || item.year || '',
    }));
  }

  return normalized;
}

function buildHtml(resumeData, design, templateHtml, templateCss) {
  const normalizedResume = normalizeResumeData(resumeData);
  const {
    primaryColor = '#2563EB',
    secondaryColor = '#1e293b',
    fontFamily = 'Inter, sans-serif',
    fontSize = 11,
    lineHeight = 1.5,
    margins = { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
  } = design || {};

  const cssVars = `
    :root {
      --primary: ${primaryColor};
      --secondary: ${secondaryColor};
      --font-family: ${fontFamily};
      --font-size: ${fontSize}pt;
      --line-height: ${lineHeight};
      --margin-top: ${margins.top}mm;
      --margin-right: ${margins.right}mm;
      --margin-bottom: ${margins.bottom}mm;
      --margin-left: ${margins.left}mm;
    }
  `;

  const baseStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Merriweather:wght@300;400;700&family=Playfair+Display:wght@400;500;700&family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
    
    :root {
      --font-size: 10pt; /* Slightly smaller default for single page */
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--font-family) !important;
      font-size: var(--font-size);
      line-height: var(--line-height);
      color: #1e293b;
      background: #fff;
      -webkit-print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      height: 297mm; /* Force A4 height */
      padding: var(--margin-top) var(--margin-right) var(--margin-bottom) var(--margin-left);
      margin: 0 auto;
      overflow: hidden; /* Hide anything that spills over to page 2 */
      position: relative;
    }

    /* Prevent sections from splitting across pages */
    section, .item, .section {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    h2 {
      margin-top: 8pt;
      margin-bottom: 4pt;
    }

    p, li {
      margin-bottom: 2pt;
    }

    a { color: var(--primary); text-decoration: none; }
    ul { padding-left: 1.2em; }
    li { margin-bottom: 2px; }
  `;

  const compiled = Handlebars.compile(templateHtml);
  const body = compiled({ ...normalizedResume, design });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resume</title>
  <style>${cssVars}${baseStyles}${templateCss || ''}</style>
</head>
<body>
  <div class="page">${body}</div>
</body>
</html>`;
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    logger.info('Launching new Puppeteer browser instance...');
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    browserInstance.on('disconnected', () => {
      logger.warn('Puppeteer browser disconnected. Will relaunch on next request.');
      browserInstance = null;
    });
  }
  return browserInstance;
}

async function generatePdf({ content, design, html, css }) {
  const pdfHtml = buildHtml(content, design, html, css);
  
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setContent(pdfHtml, { waitUntil: 'networkidle0', timeout: 30000 });

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });

    logger.info(`PDF buffer generated`);
    return buffer;
  } catch (error) {
    logger.error(`Error generating PDF: ${error.message}`);
    throw error;
  } finally {
    if (page) {
      await page.close().catch(err => logger.error(`Failed to close page: ${err.message}`));
    }
  }
}

/** Generate an HTML preview string (no file I/O) */
function generatePreviewHtml(resumeData, design, templateHtml, templateCss) {
  return buildHtml(resumeData, design, templateHtml, templateCss);
}

module.exports = { generatePdf, generatePreviewHtml, buildHtml, normalizeResumeData };
