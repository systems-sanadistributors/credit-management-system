const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { config } = require('../config/env');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const DATA_URL_REGEX = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

let s3ClientInstance = null;
let customUploader = null;

function createDefaultS3Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });
}

function getS3Client() {
  if (!s3ClientInstance) {
    s3ClientInstance = createDefaultS3Client();
  }
  return s3ClientInstance;
}

function setS3Client(client) {
  s3ClientInstance = client;
}

function setUploader(uploaderFn) {
  customUploader = uploaderFn;
}

function createValidationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function isExistingR2Url(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  const base = config.r2.publicUrl;
  return trimmed.startsWith(`${base}/`) && trimmed.length > base.length + 1;
}

function validateFileMeta(mimetype, size) {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TO_EXT, mimetype)) {
    throw createValidationError(
      'Only image/jpeg, image/png, and image/webp files are allowed'
    );
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw createValidationError('Uploaded image file cannot be empty');
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    throw createValidationError('Image file exceeds the 5MB size limit');
  }
}

async function uploadBufferToR2({ buffer, mimetype, size }, folder = 'sana-distribution') {
  if (!Buffer.isBuffer(buffer)) {
    throw createValidationError('Invalid image buffer');
  }

  validateFileMeta(mimetype, size ?? buffer.length);

  const ext = ALLOWED_MIME_TO_EXT[mimetype];
  const cleanFolder = String(folder || 'sana-distribution').replace(/^\/+|\/+$/g, '');
  const key = `${cleanFolder}/${crypto.randomUUID()}.${ext}`;

  if (customUploader) {
    return customUploader({ buffer, mimetype, key, folder: cleanFolder });
  }

  if (process.env.NODE_ENV === 'test' && !s3ClientInstance) {
    return `${config.r2.publicUrl}/${key}`;
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );

  return `${config.r2.publicUrl}/${key}`;
}

async function uploadImage(input, folder = 'sana-distribution') {
  if (input && typeof input === 'object' && Buffer.isBuffer(input.buffer)) {
    return uploadBufferToR2(input, folder);
  }

  const trimmed = String(input || '').trim();
  if (isExistingR2Url(trimmed)) {
    return trimmed;
  }

  const match = DATA_URL_REGEX.exec(trimmed);
  if (!match) {
    throw createValidationError(
      'Image must be a valid JPEG, PNG, or WEBP file'
    );
  }

  const mimetype = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return uploadBufferToR2({ buffer, mimetype, size: buffer.length }, folder);
}

module.exports = {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TO_EXT,
  uploadBufferToR2,
  uploadImage,
  isExistingR2Url,
  setS3Client,
  setUploader,
};
