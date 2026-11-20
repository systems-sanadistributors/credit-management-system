const formService = require('../services/formService');
const realtimeService = require('../services/realtimeService');

function streamForms(req, res) {
  return realtimeService.addClient(req, res);
}

async function getForms(_req, res, next) {
  try {
    const data = await formService.listFormsWithStats();
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
}

async function getFormById(req, res, next) {
  try {
    const form = await formService.getFormById(req.params.id);
    return res.status(200).json({ form });
  } catch (err) {
    return next(err);
  }
}

async function createForm(req, res, next) {
  try {
    const form = await formService.createForm(req.body, req.files);
    return res.status(201).json({ form });
  } catch (err) {
    return next(err);
  }
}

async function updateForm(req, res, next) {
  try {
    const form = await formService.updateForm(req.params.id, req.body, req.files);
    return res.status(200).json({ form });
  } catch (err) {
    return next(err);
  }
}

async function deleteForm(req, res, next) {
  try {
    await formService.deleteForm(req.params.id);
    return res.status(200).json({ message: 'Form deleted' });
  } catch (err) {
    return next(err);
  }
}

async function reviewForm(req, res, next) {
  try {
    const form = await formService.reviewForm(req.params.id, {
      role: req.user.role,
      action: req.body?.action,
      comment: req.body?.comment,
    });
    return res.status(200).json({ form });
  } catch (err) {
    return next(err);
  }
}

async function sendCredit(req, res, next) {
  try {
    const form = await formService.sendCreditToPerson5(req.params.id);
    return res.status(200).json({ form });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  streamForms,
  getForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  reviewForm,
  sendCredit,
};
