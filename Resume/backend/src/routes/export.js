const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { downloadPdf, previewResume } = require('../controllers/exportController');

/**
 * @route   GET /api/export/:resumeId/pdf
 * @desc    Generate and download a PDF of the resume
 * @access  Private
 */
router.get('/:resumeId/pdf', downloadPdf);

/**
 * @route   GET /api/export/:resumeId/preview
 * @desc    Get raw HTML preview for WYSIWYG rendering
 * @access  Public (token in query handled by frontend)
 */
router.get('/:resumeId/preview', previewResume);

module.exports = router;
