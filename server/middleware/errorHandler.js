function errorHandler(err, _req, res, _next) {
  const statusCode =
    err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message =
    statusCode < 500 && err.message ? err.message : 'Internal server error';

  res.status(statusCode).json({ error: message });
}

module.exports = { errorHandler };
