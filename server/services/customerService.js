const Customer = require('../models/Customer');
const SalesRecord = require('../models/SalesRecord');

const PLACEHOLDER_IDS = new Set(['9999999999999', '0000000000000']);

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidMatchId(digits) {
  if (!digits || digits.length < 5) return false;
  if (PLACEHOLDER_IDS.has(digits)) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

function aggregateSalesByPeriod(records) {
  const byPeriod = new Map();

  for (const rec of records) {
    const period = rec.period || 'Unknown';
    const sortKey = Number(rec.periodSortKey) || 0;
    const amount = Number(rec.amount) || 0;

    if (!byPeriod.has(period)) {
      byPeriod.set(period, { period, periodSortKey: sortKey, amount: 0 });
    }
    byPeriod.get(period).amount += amount;
  }

  return Array.from(byPeriod.values()).sort(
    (a, b) => a.periodSortKey - b.periodSortKey
  );
}

async function getCustomerWithSalesHistory(rawCustomerId) {
  if (typeof rawCustomerId !== 'string') {
    throw createHttpError(400, 'Customer ID must be a string');
  }

  const customerId = rawCustomerId.trim();
  if (!customerId || customerId.startsWith('$') || customerId.includes('.')) {
    throw createHttpError(400, 'Invalid Customer ID');
  }

  const customer = await Customer.findOne({ customerId }).lean();

  const orConditions = [{ customerId }];
  if (customer) {
    const validIds = [
      normalizeDigits(customer.cnic),
      normalizeDigits(customer.ntn),
    ].filter(isValidMatchId);

    if (validIds.length > 0) {
      orConditions.push({ buyerNtnCnic: { $in: validIds } });
    }

    const normalizedBiz = String(customer.businessName || '')
      .trim()
      .toLowerCase();
    if (normalizedBiz) {
      orConditions.push({ buyerBusinessNameNormalized: normalizedBiz });
    }
  }

  const matchedRecords = await SalesRecord.find({ $or: orConditions })
    .sort({ periodSortKey: 1, invoiceDate: 1 })
    .lean();

  if (!customer && matchedRecords.length === 0) {
    throw createHttpError(404, 'Customer ID not found');
  }

  const salesHistory = aggregateSalesByPeriod(matchedRecords);
  const totalSales = salesHistory.reduce((sum, rec) => sum + rec.amount, 0);
  const monthsCount = salesHistory.length;
  const averageSales =
    monthsCount > 0 ? Math.round((totalSales / monthsCount) * 100) / 100 : 0;

  return {
    customer: customer || null,
    salesHistory,
    summary: {
      totalSales: Math.round(totalSales * 100) / 100,
      averageSales,
      monthsCount,
    },
  };
}

module.exports = { getCustomerWithSalesHistory, isValidMatchId, normalizeDigits };
