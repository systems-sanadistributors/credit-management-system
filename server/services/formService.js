const mongoose = require('mongoose');
const Form = require('../models/Form');
const { CHANNELS, CHEQUE_STATUSES, CREDIT_TYPES } = require('../models/Form');
const emailService = require('./emailService');
const r2Service = require('./r2Service');
const realtimeService = require('./realtimeService');

const IMAGE_DATA_URL_REGEX =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_BASE64_LENGTH = 7_000_000;

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertValidObjectId(id) {
  if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError(400, 'Invalid form ID format');
  }
}

function requireNonEmptyString(val, label) {
  if (typeof val !== 'string' && typeof val !== 'number') {
    throw createHttpError(400, `${label} is required`);
  }
  const normalized = String(val).trim();
  if (normalized.length === 0) {
    throw createHttpError(400, `${label} is required`);
  }
  return normalized;
}

function optionalString(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function requireValidNumber(val, label) {
  if (val === '' || val === null || val === undefined) {
    throw createHttpError(400, `${label} is required`);
  }
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) {
    throw createHttpError(400, `${label} must be a non-negative number`);
  }
  return num;
}

function requireValidImage(val, file, label) {
  if (file && Buffer.isBuffer(file.buffer)) {
    if (!Object.prototype.hasOwnProperty.call(r2Service.ALLOWED_MIME_TO_EXT, file.mimetype)) {
      throw createHttpError(
        400,
        `${label} must be image/jpeg, image/png, or image/webp`
      );
    }
    if (file.size > r2Service.MAX_FILE_SIZE_BYTES) {
      throw createHttpError(400, `${label} exceeds the 5MB size limit`);
    }
    return file;
  }

  if (typeof val !== 'string') {
    throw createHttpError(
      400,
      `${label} must be a valid JPEG, PNG, or WEBP image`
    );
  }
  const trimmed = val.trim();
  if (r2Service.isExistingR2Url(trimmed)) {
    return trimmed;
  }
  if (!IMAGE_DATA_URL_REGEX.test(trimmed)) {
    throw createHttpError(
      400,
      `${label} must be a valid JPEG, PNG, or WEBP image`
    );
  }
  if (trimmed.length > MAX_IMAGE_BASE64_LENGTH) {
    throw createHttpError(400, `${label} exceeds the 5MB size limit`);
  }
  return trimmed;
}

function validateFormPayload(payload, files = {}) {
  if (!payload || typeof payload !== 'object') {
    throw createHttpError(400, 'Form payload is required');
  }

  const customerId = optionalString(payload.customerId);
  const cName = requireNonEmptyString(payload.cName, 'Customer Name');
  const bName = requireNonEmptyString(payload.bName, 'Business Name');
  const shopPicture = requireValidImage(
    payload.shopPicture,
    files?.shopPicture?.[0],
    'Shop Picture'
  );

  if (!CHANNELS.includes(payload.channel)) {
    throw createHttpError(
      400,
      `Channel must be one of: ${CHANNELS.join(', ')}`
    );
  }

  const cnicNo = requireNonEmptyString(payload.cnicNo, 'CNIC #');
  const ntnNo = optionalString(payload.ntnNo);
  const mobileNo = requireNonEmptyString(payload.mobileNo, 'Mobile #');
  const address = requireNonEmptyString(payload.address, 'Address');
  const days = requireNonEmptyString(payload.days, 'Days');
  const creditLimit = requireValidNumber(payload.creditLimit, 'Credit limit');

  if (!CHEQUE_STATUSES.includes(payload.chequeStatus)) {
    throw createHttpError(400, 'Security Cheque must be Y or N');
  }

  if (!CREDIT_TYPES.includes(payload.creditType)) {
    throw createHttpError(
      400,
      `Credit type must be one of: ${CREDIT_TYPES.join(', ')}`
    );
  }

  let chequeNo = '';
  let chequeAmount = null;
  let chequePicture = '';
  let bankName = '';
  let bankBranch = '';

  if (payload.chequeStatus === 'Yes') {
    chequeNo = requireNonEmptyString(payload.chequeNo, 'C. no.');
    chequeAmount = requireValidNumber(payload.chequeAmount, 'C. Amount');
    chequePicture = requireValidImage(
      payload.chequePicture,
      files?.chequePicture?.[0],
      'C. Picture'
    );
    bankName = requireNonEmptyString(payload.bankName, 'Bank name');
    if (bankName.length > 120) {
      throw createHttpError(400, 'Bank name must be 120 characters or less');
    }
    bankBranch = optionalString(payload.bankBranch);
    if (bankBranch.length > 120) {
      throw createHttpError(400, 'Bank Branch must be 120 characters or less');
    }
  }

  return {
    customerId,
    title: `${cName} — ${bName}`,
    cName,
    bName,
    shopPicture,
    channel: payload.channel,
    cnicNo,
    ntnNo,
    mobileNo,
    address,
    days,
    creditLimit,
    chequeStatus: payload.chequeStatus,
    chequeNo,
    chequeAmount,
    chequePicture,
    bankName,
    bankBranch,
    creditType: payload.creditType,
  };
}

function computeStats(forms) {
  return {
    total: forms.length,
    incomplete: forms.filter((f) => f.status === 'INCOMPLETE').length,
    completed: forms.filter((f) => f.currentStage === 5).length,
    approved: forms.filter((f) => f.status === 'APPROVED').length,
    rejected: forms.filter((f) => f.status === 'REJECTED').length,
  };
}

async function listFormsWithStats() {
  const forms = await Form.find({}).sort({ updatedAt: -1 }).lean();
  return {
    forms,
    stats: computeStats(forms),
  };
}

async function getFormById(id) {
  assertValidObjectId(id);
  const form = await Form.findById(id).lean();
  if (!form) {
    throw createHttpError(404, 'Form not found');
  }
  return form;
}

async function resolveR2Images(data) {
  const shopPictureUrl = await r2Service.uploadImage(
    data.shopPicture,
    'sana-distribution/shops'
  );
  let chequePictureUrl = '';
  if (data.chequeStatus === 'Yes' && data.chequePicture) {
    chequePictureUrl = await r2Service.uploadImage(
      data.chequePicture,
      'sana-distribution/cheques'
    );
  }
  return {
    ...data,
    shopPicture: shopPictureUrl,
    chequePicture: chequePictureUrl,
  };
}

async function createForm(payload, files = {}) {
  const validated = validateFormPayload(payload, files);
  const data = await resolveR2Images(validated);
  const created = await Form.create({
    ...data,
    currentStage: 2,
    status: 'INCOMPLETE',
    isUpdated: false,
    comments: [],
    createdBy: 1,
  });
  const formObj = created.toObject();
  realtimeService.broadcastEvent('form_upserted', { form: formObj });
  await emailService.notifyOnFormCreated(formObj);
  return formObj;
}

function assertEditableBeforeP2Approval(form) {
  if (Number(form.currentStage) > 2 || form.status === 'APPROVED') {
    throw createHttpError(
      403,
      'Form is locked from editing or deleting once approved by Person 2'
    );
  }
}

async function updateForm(id, payload, files = {}) {
  assertValidObjectId(id);
  const validated = validateFormPayload(payload, files);

  const form = await Form.findById(id);
  if (!form) {
    throw createHttpError(404, 'Form not found');
  }
  assertEditableBeforeP2Approval(form);

  const data = await resolveR2Images(validated);
  Object.assign(form, data);
  form.currentStage = 2;
  form.status = 'INCOMPLETE';
  form.comments = [];
  form.isUpdated = true;

  await form.save();
  const formObj = form.toObject();
  realtimeService.broadcastEvent('form_upserted', { form: formObj });
  await emailService.notifyOnFormEdited(formObj);
  return formObj;
}

async function deleteForm(id) {
  assertValidObjectId(id);
  const existing = await Form.findById(id).lean();
  if (!existing) {
    throw createHttpError(404, 'Form not found');
  }
  assertEditableBeforeP2Approval(existing);

  const deleted = await Form.findByIdAndDelete(id).lean();
  realtimeService.broadcastEvent('form_deleted', { id: String(deleted._id) });
  await emailService.notifyOnFormDeleted(deleted);
  return deleted;
}

async function reviewForm(id, { role, action, comment }) {
  assertValidObjectId(id);

  if (![2, 3, 4].includes(role)) {
    throw createHttpError(403, 'Only reviewers (Persons 2-4) can review forms');
  }

  if (action !== 'APPROVE' && action !== 'REJECT') {
    throw createHttpError(400, 'Action must be APPROVE or REJECT');
  }

  if (typeof comment !== 'string' || comment.trim().length === 0) {
    throw createHttpError(400, 'Reviewer comment is required');
  }

  const form = await Form.findById(id);
  if (!form) {
    throw createHttpError(404, 'Form not found');
  }

  if (form.status !== 'INCOMPLETE') {
    throw createHttpError(
      400,
      `Form is already ${form.status} and locked from further review`
    );
  }

  if (form.currentStage !== role) {
    throw createHttpError(
      403,
      `Stage mismatch: form is at stage ${form.currentStage}, cannot be reviewed by Person ${role}`
    );
  }

  const normalizedAction = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  form.comments.push({
    role,
    comment: comment.trim(),
    action: normalizedAction,
    createdAt: new Date(),
  });

  if (action === 'APPROVE') {
    form.currentStage += 1;
    if (form.currentStage === 5) {
      form.status = 'APPROVED';
    }
  } else {
    form.status = 'REJECTED';
  }

  await form.save();
  const formObj = form.toObject();
  realtimeService.broadcastEvent('form_upserted', { form: formObj });
  await emailService.notifyOnFormReviewed(formObj, {
    actorRole: role,
    action,
    comment: comment.trim(),
  });
  return formObj;
}

async function sendCreditToPerson5(id) {
  assertValidObjectId(id);
  const form = await Form.findById(id);
  if (!form) {
    throw createHttpError(404, 'Form not found');
  }

  if (form.status !== 'APPROVED' || form.currentStage !== 5) {
    throw createHttpError(
      400,
      'Credit can only be sent after final Person 4 approval (Stage 5 / APPROVED)'
    );
  }

  const formObj = form.toObject();
  await emailService.notifyPerson5Credit(formObj);

  form.creditSentAt = new Date();
  await form.save();

  const updatedObj = form.toObject();
  realtimeService.broadcastEvent('form_upserted', { form: updatedObj });
  return updatedObj;
}

module.exports = {
  listFormsWithStats,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  reviewForm,
  sendCreditToPerson5,
};
