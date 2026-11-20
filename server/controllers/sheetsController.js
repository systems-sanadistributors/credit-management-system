const sheetsSyncService = require('../services/sheetsSyncService');

let syncState = {
  status: 'idle',
  startedAt: null,
  completedAt: null,
  result: null,
  error: null,
};

function startBackgroundSync() {
  if (syncState.status === 'running') {
    return syncState;
  }

  syncState = {
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    result: null,
    error: null,
  };

  sheetsSyncService
    .syncFromGoogleSheets()
    .then((result) => {
      syncState = {
        ...syncState,
        status: 'completed',
        completedAt: new Date().toISOString(),
        result,
        error: null,
      };
    })
    .catch((err) => {
      console.error('[SHEETS] Background sync failed:', err.message);
      syncState = {
        ...syncState,
        status: 'failed',
        completedAt: new Date().toISOString(),
        result: null,
        error: err.message || 'Google Sheets sync failed',
      };
    });

  return syncState;
}

async function triggerFullSync(req, res, next) {
  const isAsync =
    req.query?.async === '1' ||
    req.query?.async === 'true' ||
    req.body?.async === true;

  if (isAsync) {
    const state = startBackgroundSync();
    return res.status(202).json(state);
  }

  try {
    const result = await sheetsSyncService.syncFromGoogleSheets();
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

function getSyncStatus(_req, res) {
  return res.status(200).json(syncState);
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

module.exports = { triggerFullSync, getSyncStatus, handleWebhook };
