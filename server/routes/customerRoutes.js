const express = require('express');
const customerController = require('../controllers/customerController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/:customerId',
  requireAuth,
  requireRole(1, 2, 3, 4),
  customerController.getCustomerById
);

module.exports = router;
