const { google } = require('googleapis');
const XLSX = require('xlsx');
const Customer = require('../models/Customer');
const SalesRecord = require('../models/SalesRecord');
const { config, validateGoogleSheetsConfig } = require('../config/env');

const BULK_CHUNK_SIZE = 1000;
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const EXCEL_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const READONLY_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];

const CUSTOMER_HEADER_MAP = {
  customerid: 'customerId',
  id: 'customerId',
  custid: 'customerId',
  code: 'customerId',
  customercode: 'customerId',
  custcode: 'customerId',
  ccode: 'customerId',
  accountcode: 'customerId',
  acccode: 'customerId',
  partycode: 'customerId',
  partyid: 'customerId',
  clientcode: 'customerId',
  clientid: 'customerId',
  cname: 'customerName',
  customername: 'customerName',
  name: 'customerName',
  proprietor: 'customerName',
  bname: 'businessName',
  businessname: 'businessName',
  shopname: 'businessName',
  shop: 'businessName',
  channel: 'channel',
  tradechannel: 'channel',
  cnic: 'cnic',
  cnicno: 'cnic',
  cnicnumber: 'cnic',
  nic: 'cnic',
  nicno: 'cnic',
  ntn: 'ntn',
  ntnno: 'ntn',
  ntnnumber: 'ntn',
  salestax: 'ntn',
  salestaxno: 'ntn',
  salestaxnumber: 'ntn',
  strn: 'ntn',
  mobile: 'mobile',
  mobileno: 'mobile',
  mobilenumber: 'mobile',
  phone: 'mobile',
  phoneno: 'mobile',
  contact: 'mobile',
  contactno: 'mobile',
  contactnumber: 'mobile',
  cell: 'mobile',
  cellno: 'mobile',
  address: 'address',
  shopaddress: 'address',
  location: 'address',
  addressline1: 'addressLine1',
  address1: 'addressLine1',
  addressline2: 'addressLine2',
  address2: 'addressLine2',
  days: 'days',
  creditdays: 'days',
  paymentdays: 'days',
  creditlimit: 'creditLimit',
  limit: 'creditLimit',
};

const SALES_HEADER_MAP = {
  userinvoiceid: 'invoiceId',
  invoiceid: 'invoiceId',
  invoiceno: 'invoiceId',
  invoicetype: 'invoiceType',
  invoicedate: 'invoiceDate',
  buyerntncnic: 'buyerNtnCnic',
  ntncnic: 'buyerNtnCnic',
  buyerbusinessname: 'buyerBusinessName',
  buyerprovince: 'buyerProvince',
  buyeraddress: 'buyerAddress',
  customerid: 'customerId',
  id: 'customerId',
  custid: 'customerId',
  code: 'customerId',
  customercode: 'customerId',
  period: 'period',
  month: 'period',
  date: 'period',
  salesmonth: 'period',
  billingmonth: 'period',
  monthyear: 'period',
  amount: 'amount',
  totalamount: 'amount',
  netamount: 'amount',
  invoiceamount: 'amount',
  grandtotal: 'amount',
  totalvalue: 'amount',
  totalvalues: 'amount',
  valuewithoutsalestax: 'valueWithoutTax',
  salestaxapplicable: 'salesTaxApplicable',
  retailprice: 'retailPrice',
  sales: 'amount',
  salesamount: 'amount',
  netsales: 'amount',
  total: 'amount',
  totalsales: 'amount',
  value: 'amount',
  quantity: 'quantity',
  qty: 'quantity',
};

const MONTH_INDEX = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

let customSheetsClient = null;
let customDriveClient = null;
let salesIndexesSynced = false;

async function ensureSalesIndexes() {
  if (salesIndexesSynced) return;
  await SalesRecord.syncIndexes();
  salesIndexesSynced = true;
}

function setSheetsClient(client) {
  customSheetsClient = client;
}

function setDriveClient(client) {
  customDriveClient = client;
}

function normalizeHeaderKey(header) {
  return String(header || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function sanitizeCell(value) {
  if (value === null || value === undefined || typeof value === 'object') {
    return '';
  }
  return String(value).replace(/\0/g, '').trim();
}

function normalizeDigits(value) {
  return sanitizeCell(value).replace(/\D/g, '');
}

function parseAmount(value) {
  const cleaned = sanitizeCell(value).replace(/[^0-9.-]/g, '');
  if (!cleaned) return NaN;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseInvoiceDate(raw) {
  const str = sanitizeCell(raw);
  if (!str) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(str);
  if (m) {
    const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(str);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]);
    const month = b <= 12 ? b : a;
    const day = b <= 12 ? a : b;
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizePeriod(raw) {
  const str = sanitizeCell(raw);
  if (!str) return null;

  let m = /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/.exec(str);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) {
      return {
        period: `${year}-${String(month).padStart(2, '0')}`,
        periodSortKey: year * 100 + month,
      };
    }
  }

  m = /^(\d{1,2})[-/](\d{4})$/.exec(str);
  if (m) {
    const month = Number(m[1]);
    const year = Number(m[2]);
    if (month >= 1 && month <= 12) {
      return {
        period: `${year}-${String(month).padStart(2, '0')}`,
        periodSortKey: year * 100 + month,
      };
    }
  }

  m = /^([a-zA-Z]+)[\s,-]+(\d{2,4})$/.exec(str);
  if (m) {
    const month = MONTH_INDEX[m[1].toLowerCase()];
    const rawYear = Number(m[2]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    if (month) {
      return {
        period: `${year}-${String(month).padStart(2, '0')}`,
        periodSortKey: year * 100 + month,
      };
    }
  }

  const dt = parseInvoiceDate(str);
  if (dt) {
    const year = dt.getUTCFullYear();
    const month = dt.getUTCMonth() + 1;
    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      periodSortKey: year * 100 + month,
    };
  }

  return null;
}

function mapObjectRow(rawRow, headerMap) {
  if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
    return {};
  }
  const mapped = {};
  for (const [key, val] of Object.entries(rawRow)) {
    if (
      key.startsWith('$') ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    ) {
      continue;
    }
    const targetField = headerMap[normalizeHeaderKey(key)];
    if (targetField) {
      mapped[targetField] = val;
    }
  }
  return mapped;
}

function rowsMatrixToObjects(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) return [];
  const headers = matrix[0].map((h) => sanitizeCell(h));
  const objects = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const obj = {};
    let hasAnyValue = false;
    for (let c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      const cell = sanitizeCell(row[c]);
      if (cell !== '') hasAnyValue = true;
      obj[headers[c]] = cell;
    }
    if (hasAnyValue) objects.push(obj);
  }
  return objects;
}

function detectSheetType(headersRow) {
  if (!Array.isArray(headersRow) || headersRow.length === 0) return null;
  const normalized = new Set(headersRow.map((h) => normalizeHeaderKey(h)));

  const hasCustomerCols =
    (normalized.has('code') || normalized.has('customerid')) &&
    (normalized.has('customername') || normalized.has('cname'));
  if (hasCustomerCols) return 'customer';

  const hasSalesCols =
    (normalized.has('userinvoiceid') || normalized.has('invoiceid')) &&
    normalized.has('invoicedate');
  if (hasSalesCols) return 'sales';

  return null;
}

async function bulkWriteInChunks(Model, operations, chunkSize = BULK_CHUNK_SIZE) {
  let chunksExecuted = 0;
  for (let i = 0; i < operations.length; i += chunkSize) {
    const chunk = operations.slice(i, i + chunkSize);
    await Model.bulkWrite(chunk, { ordered: false });
    chunksExecuted += 1;
  }
  return chunksExecuted;
}

async function upsertCustomerRows(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { synced: 0, skipped: 0, chunks: 0 };
  }

  const deduped = new Map();
  let skipped = 0;
  const now = new Date();

  for (const rawRow of rawRows) {
    const m = mapObjectRow(rawRow, CUSTOMER_HEADER_MAP);
    const customerId = sanitizeCell(m.customerId);
    if (!customerId) {
      skipped += 1;
      continue;
    }

    const parsedLimit = parseAmount(m.creditLimit);
    const resolvedAddress =
      sanitizeCell(m.address) ||
      sanitizeCell(m.addressLine1) ||
      sanitizeCell(m.addressLine2) ||
      '';

    deduped.set(customerId, {
      customerId,
      customerName: sanitizeCell(m.customerName),
      businessName: sanitizeCell(m.businessName),
      channel: sanitizeCell(m.channel),
      cnic: sanitizeCell(m.cnic),
      ntn: sanitizeCell(m.ntn),
      mobile: sanitizeCell(m.mobile),
      address: resolvedAddress,
      days: sanitizeCell(m.days),
      creditLimit: Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : null,
      syncedAt: now,
    });
  }

  const ops = Array.from(deduped.values()).map((doc) => ({
    updateOne: {
      filter: { customerId: doc.customerId },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const chunks = await bulkWriteInChunks(Customer, ops);
  return { synced: ops.length, skipped, chunks };
}

async function upsertSalesRows(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { synced: 0, skipped: 0, chunks: 0 };
  }

  const dedupedByInvoice = new Map();
  const dedupedByPeriod = new Map();
  let skipped = 0;

  for (const rawRow of rawRows) {
    const m = mapObjectRow(rawRow, SALES_HEADER_MAP);
    const invoiceId = sanitizeCell(m.invoiceId);
    const customerId = sanitizeCell(m.customerId);
    const primaryAmount = parseAmount(m.amount);
    const fallbackExclTax = parseAmount(m.valueWithoutTax);
    const fallbackRetail = parseAmount(m.retailPrice);
    const parsedAmount = Number.isFinite(primaryAmount)
      ? primaryAmount
      : Number.isFinite(fallbackExclTax)
        ? fallbackExclTax
        : Number.isFinite(fallbackRetail)
          ? fallbackRetail
          : NaN;
    const parsedQty = parseAmount(m.quantity);

    if (invoiceId) {
      const invoiceDate = parseInvoiceDate(m.invoiceDate);
      const periodInfo =
        normalizePeriod(m.invoiceDate) || normalizePeriod(m.period);
      if (!periodInfo) {
        skipped += 1;
        continue;
      }

      const buyerBusinessName = sanitizeCell(m.buyerBusinessName);
      dedupedByInvoice.set(invoiceId, {
        invoiceId,
        invoiceType: sanitizeCell(m.invoiceType),
        invoiceDate,
        buyerNtnCnic: normalizeDigits(m.buyerNtnCnic),
        buyerBusinessName,
        buyerBusinessNameNormalized: buyerBusinessName.toLowerCase(),
        buyerProvince: sanitizeCell(m.buyerProvince),
        buyerAddress: sanitizeCell(m.buyerAddress),
        quantity: Number.isFinite(parsedQty) ? parsedQty : null,
        customerId,
        period: periodInfo.period,
        periodSortKey: periodInfo.periodSortKey,
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      });
      continue;
    }

    const normalized = normalizePeriod(m.period);
    if (!customerId || !normalized || !Number.isFinite(parsedAmount)) {
      skipped += 1;
      continue;
    }

    dedupedByPeriod.set(`${customerId}::${normalized.period}`, {
      customerId,
      period: normalized.period,
      periodSortKey: normalized.periodSortKey,
      amount: parsedAmount,
    });
  }

  const ops = [];
  for (const doc of dedupedByInvoice.values()) {
    ops.push({
      updateOne: {
        filter: { invoiceId: doc.invoiceId },
        update: { $set: doc },
        upsert: true,
      },
    });
  }
  for (const doc of dedupedByPeriod.values()) {
    ops.push({
      updateOne: {
        filter: { customerId: doc.customerId, period: doc.period },
        update: { $set: doc },
        upsert: true,
      },
    });
  }

  await ensureSalesIndexes();
  const chunks = await bulkWriteInChunks(SalesRecord, ops);
  return { synced: ops.length, skipped, chunks };
}

function getGoogleAuth(sheetsConfig) {
  return new google.auth.JWT({
    email: sheetsConfig.serviceAccountEmail,
    key: sheetsConfig.privateKey,
    scopes: READONLY_SCOPES,
  });
}

function getSheetsApiClient(sheetsConfig) {
  if (customSheetsClient) return customSheetsClient;
  return google.sheets({ version: 'v4', auth: getGoogleAuth(sheetsConfig) });
}

function getDriveApiClient(sheetsConfig) {
  if (customDriveClient) return customDriveClient;
  return google.drive({ version: 'v3', auth: getGoogleAuth(sheetsConfig) });
}

function formatTabName(rawTitle) {
  const cleaned = String(rawTitle || '')
    .split('!')[0]
    .replace(/^'+|'+$/g, '')
    .trim();
  if (!cleaned) return '';
  return /\s/.test(cleaned) ? `'${cleaned.replace(/'/g, "''")}'` : cleaned;
}

async function resolveSheetTabName(sheets, spreadsheetId, configuredRange) {
  const explicitTab = formatTabName(configuredRange);
  if (explicitTab) return explicitTab;

  if (typeof sheets?.spreadsheets?.get === 'function') {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const firstTitle = meta?.data?.sheets?.[0]?.properties?.title;
    const detected = formatTabName(firstTitle);
    if (detected) return detected;
  }

  return 'Sheet1';
}

async function listSpreadsheetsInFolder(drive, folderId) {
  const files = [];
  let pageToken = undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType = '${GOOGLE_SHEET_MIME}' or mimeType = '${EXCEL_XLSX_MIME}') and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (Array.isArray(res?.data?.files)) {
      files.push(...res.data.files);
    }
    pageToken = res?.data?.nextPageToken;
  } while (pageToken);

  return files;
}

async function readExcelFileToMatrix(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  const workbook = XLSX.read(Buffer.from(res.data), {
    type: 'buffer',
    cellDates: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: '',
    raw: false,
  });
}

async function syncFromGoogleSheets(sheetsConfigOverride) {
  const sheetsConfig = sheetsConfigOverride
    ? validateGoogleSheetsConfig(sheetsConfigOverride)
    : customSheetsClient || customDriveClient
      ? {
          driveFolderId: config.sheets.driveFolderId || '',
          customerSheetId: config.sheets.customerSheetId || '',
          customerSheetRange: config.sheets.customerSheetRange || '',
          salesSheetId: config.sheets.salesSheetId || '',
          salesSheetRange: config.sheets.salesSheetRange || '',
        }
      : validateGoogleSheetsConfig(config.sheets);

  const sheets = getSheetsApiClient(sheetsConfig);
  const sources = new Map();

  try {
    const drive = sheetsConfig.driveFolderId ? getDriveApiClient(sheetsConfig) : null;

    if (drive && sheetsConfig.driveFolderId) {
      const folderFiles = await listSpreadsheetsInFolder(
        drive,
        sheetsConfig.driveFolderId
      );
      for (const file of folderFiles) {
        if (file?.id) {
          sources.set(file.id, {
            spreadsheetId: file.id,
            mimeType: file.mimeType || GOOGLE_SHEET_MIME,
            range: '',
            fallbackType: null,
          });
        }
      }
    }

    if (sheetsConfig.customerSheetId && !sources.has(sheetsConfig.customerSheetId)) {
      sources.set(sheetsConfig.customerSheetId, {
        spreadsheetId: sheetsConfig.customerSheetId,
        mimeType: GOOGLE_SHEET_MIME,
        range: sheetsConfig.customerSheetRange || '',
        fallbackType: 'customer',
      });
    }

    if (sheetsConfig.salesSheetId && !sources.has(sheetsConfig.salesSheetId)) {
      sources.set(sheetsConfig.salesSheetId, {
        spreadsheetId: sheetsConfig.salesSheetId,
        mimeType: GOOGLE_SHEET_MIME,
        range: sheetsConfig.salesSheetRange || '',
        fallbackType: 'sales',
      });
    }

    const customerBatches = [];
    const salesBatches = [];

    for (const src of sources.values()) {
      let matrix = [];
      if (src.mimeType === EXCEL_XLSX_MIME && drive) {
        matrix = await readExcelFileToMatrix(drive, src.spreadsheetId);
      } else {
        const tabName = await resolveSheetTabName(sheets, src.spreadsheetId, src.range);
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: src.spreadsheetId,
          range: tabName,
        });
        matrix = res?.data?.values || [];
      }
      if (matrix.length < 2) continue;

      const detectedType = detectSheetType(matrix[0]) || src.fallbackType;
      const objects = rowsMatrixToObjects(matrix);
      if (detectedType === 'customer') {
        customerBatches.push(objects);
      } else if (detectedType === 'sales') {
        salesBatches.push(objects);
      }
    }

    let customersSynced = 0;
    let salesRecordsSynced = 0;
    let skippedRows = 0;

    for (const batch of customerBatches) {
      const res = await upsertCustomerRows(batch);
      customersSynced += res.synced;
      skippedRows += res.skipped;
    }

    for (const batch of salesBatches) {
      const res = await upsertSalesRows(batch);
      salesRecordsSynced += res.synced;
      skippedRows += res.skipped;
    }

    return {
      customersSynced,
      salesRecordsSynced,
      skippedRows,
    };
  } catch (err) {
    if (err.statusCode) throw err;
    const googleDetail = err?.response?.data?.error_description || err.message;
    const wrapped = new Error(`Google Sheets/Drive sync error: ${googleDetail}`);
    wrapped.statusCode = 502;
    throw wrapped;
  }
}

module.exports = {
  BULK_CHUNK_SIZE,
  setSheetsClient,
  setDriveClient,
  formatTabName,
  resolveSheetTabName,
  listSpreadsheetsInFolder,
  detectSheetType,
  normalizeDigits,
  normalizePeriod,
  rowsMatrixToObjects,
  upsertCustomerRows,
  upsertSalesRows,
  syncFromGoogleSheets,
};
