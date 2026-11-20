const multer = require('multer');
const { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TO_EXT } = require('../services/r2Service');

const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TO_EXT, file.mimetype)) {
    const err = new Error(
      'Only image/jpeg, image/png, and image/webp files are allowed'
    );
    err.statusCode = 400;
    return cb(err);
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter,
});

const parseFields = upload.fields([
  { name: 'shopPicture', maxCount: 1 },
  { name: 'chequePicture', maxCount: 1 },
]);

function uploadFormImages(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return next();
  }

  return parseFields(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        err.message = 'Image file exceeds the 5MB size limit';
      }
      err.statusCode = 400;
    } else if (!err.statusCode) {
      err.statusCode = 400;
    }
    return next(err);
  });
}

module.exports = { uploadFormImages };
