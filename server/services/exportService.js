const ExcelJS = require('exceljs');
const Form = require('../models/Form');

const EMPTY_VALUE = '---';
const IMAGE_FETCH_TIMEOUT_MS = 4500;
const IMAGE_FETCH_CONCURRENCY = 6;

const COLUMNS = [
  { header: 'Record ID', key: 'recordId', width: 14 },
  { header: 'Customer ID', key: 'customerId', width: 16 },
  { header: 'Customer Name', key: 'cName', width: 22 },
  { header: 'Business Name', key: 'bName', width: 26 },
  { header: 'Channel', key: 'channel', width: 14 },
  { header: 'CNIC #', key: 'cnicNo', width: 18 },
  { header: 'NTN #', key: 'ntnNo', width: 16 },
  { header: 'Mobile #', key: 'mobileNo', width: 16 },
  { header: 'Address', key: 'address', width: 34 },
  { header: 'Credit Days', key: 'days', width: 12 },
  { header: 'Credit Limit', key: 'creditLimit', width: 15 },
  { header: 'Credit Type', key: 'creditType', width: 14 },
  { header: 'Security Cheque', key: 'chequeStatus', width: 16 },
  { header: 'Cheque #', key: 'chequeNo', width: 18 },
  { header: 'Cheque Amount', key: 'chequeAmount', width: 16 },
  { header: 'Bank Name', key: 'bankName', width: 20 },
  { header: 'Bank Branch', key: 'bankBranch', width: 20 },
  { header: 'Approval / Rejection', key: 'approvalStatus', width: 24 },
  { header: 'P1 Status', key: 'p1Status', width: 22 },
  { header: 'P2 Status', key: 'p2Status', width: 28 },
  { header: 'P3 Status', key: 'p3Status', width: 28 },
  { header: 'P4 Status', key: 'p4Status', width: 28 },
  { header: 'Edit Reset Flag', key: 'isUpdatedFlag', width: 16 },
  { header: 'Submitted Date', key: 'createdAt', width: 18 },
  { header: 'Last Updated', key: 'updatedAt', width: 18 },
  { header: 'Shop Picture', key: 'shopPicture', width: 20 },
  { header: 'Cheque Picture', key: 'chequePicture', width: 20 },
];

function dashIfEmpty(value) {
  if (value === undefined || value === null) return EMPTY_VALUE;
  const str = String(value).trim();
  return str.length > 0 ? str : EMPTY_VALUE;
}

function numberOrDash(value) {
  if (value === undefined || value === null || value === '') return EMPTY_VALUE;
  const num = Number(value);
  return Number.isFinite(num) ? num : EMPTY_VALUE;
}

function formatDate(dateVal) {
  if (!dateVal) return EMPTY_VALUE;
  const date = new Date(dateVal);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return date.toISOString().slice(0, 10);
}

function formatApprovalStatus(form) {
  if (form.status === 'APPROVED') return 'APPROVED';
  if (form.status === 'REJECTED') {
    return `REJECTED (Stage ${form.currentStage})`;
  }
  return `INCOMPLETE (Stage ${form.currentStage})`;
}

function formatP1Status(form) {
  return form.isUpdated ? 'Submitted (Updated / Reset)' : 'Submitted';
}

function formatCheckerStatus(form, targetRole) {
  const comments = Array.isArray(form.comments) ? form.comments : [];
  const entry = [...comments]
    .reverse()
    .find((c) => Number(c.role) === targetRole);

  if (entry) {
    const note = entry.comment ? String(entry.comment).trim() : '';
    return note ? `${entry.action}: ${note}` : entry.action;
  }

  if (form.status === 'APPROVED' || Number(form.currentStage) > targetRole) {
    return 'APPROVED';
  }

  if (form.status === 'REJECTED') {
    return Number(form.currentStage) === targetRole ? 'REJECTED' : EMPTY_VALUE;
  }

  if (Number(form.currentStage) === targetRole) {
    return 'Pending Review';
  }

  return `Awaiting P${form.currentStage}`;
}

function parseDataUrlImage(dataUrl) {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(
    dataUrl
  );
  if (!match) return null;
  const ext = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
  if (ext === 'webp') {
    return { fallbackText: 'WEBP Image (Data URL)' };
  }
  return {
    buffer: Buffer.from(match[2], 'base64'),
    extension: ext,
  };
}

function inferImageExtension(contentType = '', url = '') {
  const ct = String(contentType).toLowerCase();
  if (ct.includes('image/png')) return 'png';
  if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return 'jpeg';
  if (ct.includes('image/webp')) return 'webp';

  const cleanUrl = String(url).split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.png')) return 'png';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'jpeg';
  if (cleanUrl.endsWith('.webp')) return 'webp';
  return null;
}

async function resolveImageAsset(source, fetcher = fetch) {
  const raw = typeof source === 'string' ? source.trim() : '';
  if (!raw) return null;

  if (raw.startsWith('data:image/')) {
    return parseDataUrlImage(raw);
  }

  if (!/^https?:\/\//i.test(raw)) {
    return { fallbackText: raw };
  }

  try {
    const res = await fetcher(raw, {
      signal:
        typeof AbortSignal !== 'undefined' && AbortSignal.timeout
          ? AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS)
          : undefined,
    });
    if (!res.ok) {
      return { fallbackUrl: raw };
    }
    const contentType = res.headers?.get?.('content-type') || '';
    const ext = inferImageExtension(contentType, raw);
    if (ext !== 'png' && ext !== 'jpeg') {
      return { fallbackUrl: raw };
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
      return { fallbackUrl: raw };
    }
    return { buffer, extension: ext, url: raw };
  } catch (_err) {
    return { fallbackUrl: raw };
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker()
  );
  await Promise.all(workers);
  return results;
}

async function buildCustomersWorkbookBuffer(forms, options = {}) {
  const fetcher = options.fetcher || fetch;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sana Distributors';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Customers Export', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = COLUMNS;

  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF18181B' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF3F3F46' } },
      bottom: { style: 'thin', color: { argb: 'FF3F3F46' } },
      left: { style: 'thin', color: { argb: 'FF3F3F46' } },
      right: { style: 'thin', color: { argb: 'FF3F3F46' } },
    };
  });

  const resolvedImages = await mapWithConcurrency(
    forms,
    IMAGE_FETCH_CONCURRENCY,
    async (form) => {
      const hasCheque = form.chequeStatus === 'Yes';
      const [shopAsset, chequeAsset] = await Promise.all([
        resolveImageAsset(form.shopPicture, fetcher),
        hasCheque ? resolveImageAsset(form.chequePicture, fetcher) : Promise.resolve(null),
      ]);
      return { shopAsset, chequeAsset };
    }
  );

  const shopColIndex = COLUMNS.findIndex((c) => c.key === 'shopPicture');
  const chequeColIndex = COLUMNS.findIndex((c) => c.key === 'chequePicture');

  forms.forEach((form, index) => {
    const hasCheque = form.chequeStatus === 'Yes';
    const { shopAsset, chequeAsset } = resolvedImages[index];

    const rowValues = {
      recordId: form._id ? `#${String(form._id).slice(-6).toUpperCase()}` : EMPTY_VALUE,
      customerId: dashIfEmpty(form.customerId),
      cName: dashIfEmpty(form.cName),
      bName: dashIfEmpty(form.bName),
      channel: dashIfEmpty(form.channel),
      cnicNo: dashIfEmpty(form.cnicNo),
      ntnNo: dashIfEmpty(form.ntnNo),
      mobileNo: dashIfEmpty(form.mobileNo),
      address: dashIfEmpty(form.address),
      days: dashIfEmpty(form.days),
      creditLimit: numberOrDash(form.creditLimit),
      creditType: dashIfEmpty(form.creditType),
      chequeStatus: dashIfEmpty(form.chequeStatus),
      chequeNo: hasCheque ? dashIfEmpty(form.chequeNo) : EMPTY_VALUE,
      chequeAmount: hasCheque ? numberOrDash(form.chequeAmount) : EMPTY_VALUE,
      bankName: hasCheque ? dashIfEmpty(form.bankName) : EMPTY_VALUE,
      bankBranch: hasCheque ? dashIfEmpty(form.bankBranch) : EMPTY_VALUE,
      approvalStatus: formatApprovalStatus(form),
      p1Status: formatP1Status(form),
      p2Status: formatCheckerStatus(form, 2),
      p3Status: formatCheckerStatus(form, 3),
      p4Status: formatCheckerStatus(form, 4),
      isUpdatedFlag: form.isUpdated ? 'Updated / Reset' : EMPTY_VALUE,
      createdAt: formatDate(form.createdAt),
      updatedAt: formatDate(form.updatedAt),
      shopPicture: shopAsset?.buffer
        ? ''
        : shopAsset?.fallbackUrl
          ? { text: 'View Image', hyperlink: shopAsset.fallbackUrl }
          : shopAsset?.fallbackText || EMPTY_VALUE,
      chequePicture: chequeAsset?.buffer
        ? ''
        : chequeAsset?.fallbackUrl
          ? { text: 'View Image', hyperlink: chequeAsset.fallbackUrl }
          : chequeAsset?.fallbackText || EMPTY_VALUE,
    };

    const row = sheet.addRow(rowValues);
    const hasEmbeddedImage = Boolean(shopAsset?.buffer || chequeAsset?.buffer);
    row.height = hasEmbeddedImage ? 68 : 24;

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        bottom: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
      };
    });

    const excelZeroBasedRow = row.number - 1;
    if (shopAsset?.buffer) {
      const imageId = workbook.addImage({
        buffer: shopAsset.buffer,
        extension: shopAsset.extension,
      });
      sheet.addImage(imageId, {
        tl: { col: shopColIndex + 0.08, row: excelZeroBasedRow + 0.08 },
        ext: { width: 96, height: 64 },
        editAs: 'oneCell',
      });
    }

    if (chequeAsset?.buffer) {
      const imageId = workbook.addImage({
        buffer: chequeAsset.buffer,
        extension: chequeAsset.extension,
      });
      sheet.addImage(imageId, {
        tl: { col: chequeColIndex + 0.08, row: excelZeroBasedRow + 0.08 },
        ext: { width: 96, height: 64 },
        editAs: 'oneCell',
      });
    }
  });

  if (forms.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: forms.length + 1, column: COLUMNS.length },
    };
  }

  return workbook.xlsx.writeBuffer();
}

async function generateCustomersExcelExport(options = {}) {
  const forms = await Form.find({}).sort({ updatedAt: -1 }).lean();
  const buffer = await buildCustomersWorkbookBuffer(forms, options);
  return Buffer.from(buffer);
}

module.exports = {
  COLUMNS,
  EMPTY_VALUE,
  dashIfEmpty,
  formatApprovalStatus,
  formatP1Status,
  formatCheckerStatus,
  buildCustomersWorkbookBuffer,
  generateCustomersExcelExport,
};
