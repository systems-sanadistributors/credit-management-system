const sheetsSyncService = require('../services/sheetsSyncService');

async function triggerFullSync(_req, res, next) {
  try {
    const result = await sheetsSyncService.syncFromGoogleSheets();
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function handleWebhook(req, res, next) {
  try {
    const { type, rows } = req.body || {};

    if (type !== 'customer' && type !== 'sales') {
      return res
        .status(400)
        .json({ error: 'Webhook type must be "customer" or "sales"' });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res
        .status(400)
        .json({ error: 'Webhook rows must be a non-empty array' });
    }

    const result =
      type === 'customer'
        ? await sheetsSyncService.upsertCustomerRows(rows)
        : await sheetsSyncService.upsertSalesRows(rows);

    return res.status(200).json({ type, ...result });
  } catch (err) {
    return next(err);
  }
}

module.exports = { triggerFullSync, handleWebhook };
