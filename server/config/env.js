const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const REQUIRED_ENV_KEYS = [
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
  'CLIENT_URL',
  'PERSON1_LOGIN',
  'PERSON2_LOGIN',
  'PERSON3_LOGIN',
  'PERSON4_LOGIN',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'PERSON1_EMAIL',
  'PERSON2_EMAIL',
  'PERSON3_EMAIL',
  'PERSON4_EMAIL',
  'PERSON5_EMAIL',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
  'SHEETS_WEBHOOK_SECRET',
];

const GOOGLE_SHEETS_SYNC_KEYS = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
];

function normalizePrivateKey(rawKey) {
  if (!rawKey) return '';
  let key = String(rawKey).trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');
}

function validateEnv(envSource = process.env) {
  const missing = REQUIRED_ENV_KEYS.filter(
    (key) => !envSource[key] || String(envSource[key]).trim() === ''
  );

  if (missing.length > 0) {
    console.error(
      `[FATAL] Missing required environment variables: ${missing.join(', ')}`
    );
    process.exit(1);
  }

  return {
    port: Number(envSource.PORT) || 5000,
    mongoUri: envSource.MONGO_URI,
    jwtSecret: envSource.JWT_SECRET,
    clientUrl: envSource.CLIENT_URL,
    passkeys: {
      1: envSource.PERSON1_LOGIN,
      2: envSource.PERSON2_LOGIN,
      3: envSource.PERSON3_LOGIN,
      4: envSource.PERSON4_LOGIN,
    },
    smtp: {
      host: envSource.SMTP_HOST,
      port: Number(envSource.SMTP_PORT) || 587,
      user: envSource.SMTP_USER,
      pass: envSource.SMTP_PASS,
      from: envSource.MAIL_FROM,
    },
    emails: {
      1: envSource.PERSON1_EMAIL,
      2: envSource.PERSON2_EMAIL,
      3: envSource.PERSON3_EMAIL,
      4: envSource.PERSON4_EMAIL,
      5: envSource.PERSON5_EMAIL,
    },
    r2: {
      accountId: envSource.R2_ACCOUNT_ID,
      accessKeyId: envSource.R2_ACCESS_KEY_ID,
      secretAccessKey: envSource.R2_SECRET_ACCESS_KEY,
      bucketName: envSource.R2_BUCKET_NAME,
      publicUrl: String(envSource.R2_PUBLIC_URL).replace(/\/+$/, ''),
    },
    sheets: {
      serviceAccountEmail: String(envSource.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim(),
      privateKey: normalizePrivateKey(envSource.GOOGLE_PRIVATE_KEY),
      driveFolderId: String(envSource.GOOGLE_DRIVE_FOLDER_ID || '').trim(),
      customerSheetId: String(envSource.CUSTOMER_SHEET_ID || '').trim(),
      customerSheetRange: String(envSource.CUSTOMER_SHEET_RANGE || '').trim(),
      salesSheetId: String(envSource.SALES_SHEET_ID || '').trim(),
      salesSheetRange: String(envSource.SALES_SHEET_RANGE || '').trim(),
      webhookSecret: String(envSource.SHEETS_WEBHOOK_SECRET || '').trim(),
    },
  };
}

function validateGoogleSheetsConfig(sheetsConfig = config.sheets) {
  const keyMap = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: sheetsConfig?.serviceAccountEmail,
    GOOGLE_PRIVATE_KEY: sheetsConfig?.privateKey,
  };

  const missing = GOOGLE_SHEETS_SYNC_KEYS.filter(
    (key) => !keyMap[key] || String(keyMap[key]).trim() === ''
  );

  const hasSource =
    Boolean(sheetsConfig?.driveFolderId) ||
    Boolean(sheetsConfig?.customerSheetId) ||
    Boolean(sheetsConfig?.salesSheetId);

  if (!hasSource) {
    missing.push('GOOGLE_DRIVE_FOLDER_ID (or CUSTOMER_SHEET_ID)');
  }

  if (missing.length > 0) {
    const err = new Error(
      `Google Sheets sync is not configured. Missing env variables: ${missing.join(', ')}`
    );
    err.statusCode = 503;
    console.error(`[SHEETS] ${err.message}`);
    throw err;
  }

  return sheetsConfig;
}

const config = validateEnv(process.env);

module.exports = {
  config,
  validateEnv,
  validateGoogleSheetsConfig,
  REQUIRED_ENV_KEYS,
  GOOGLE_SHEETS_SYNC_KEYS,
  normalizePrivateKey,
};
