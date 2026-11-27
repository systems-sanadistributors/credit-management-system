const express = require('express');
const formController = require('../controllers/formController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadFormImages } = require('../middleware/upload');
const { sanitizeRequest } = require('../middleware/sanitize');

const router = express.Router();

router.get('/', requireAuth, requireRole(1, 2, 3, 4, 5), formController.getForms);
router.get(
  '/stream',
  requireAuth,
  requireRole(1, 2, 3, 4, 5),
  formController.streamForms
);
router.get(
  '/:id',
  requireAuth,
  requireRole(1, 2, 3, 4, 5),
  formController.getFormById
);
router.post(
  '/',
  requireAuth,
  requireRole(1),
  uploadFormImages,
  sanitizeRequest,
  formController.createForm
);
router.put(
  '/:id',
  requireAuth,
  requireRole(1),
  uploadFormImages,
  sanitizeRequest,
  formController.updateForm
);
router.delete('/:id', requireAuth, requireRole(1), formController.deleteForm);
router.post(
  '/:id/review',
  requireAuth,
  requireRole(2, 3, 4),
  formController.reviewForm
);
router.post(
  '/:id/send-credit',
  requireAuth,
  requireRole(4),
  formController.sendCredit
);

module.exports = router;
