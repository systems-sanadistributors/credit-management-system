const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connectDB, disconnectDB } = require('../config/db');
const {
  validateGoogleSheetsConfig,
  normalizePrivateKey,
} = require('../config/env');
const Customer = require('../models/Customer');
const SalesRecord = require('../models/SalesRecord');
const Form = require('../models/Form');
const sheetsSyncService = require('../services/sheetsSyncService');
const customerService = require('../services/customerService');

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/sana_approval_test_phase7_sync';

describe('Phase 1 (Sheets Sync): Env Validation, Models & 10,000-Row Chunked BulkWrite Upsert', () => {
  before(async () => {
    await connectDB(TEST_DB_URI);
    await Promise.all([
      Customer.deleteMany({}),
      SalesRecord.deleteMany({}),
      Form.deleteMany({}),
    ]);
  });

  after(async () => {
    sheetsSyncService.setSheetsClient(null);
    sheetsSyncService.setDriveClient(null);
    await Promise.all([
      Customer.deleteMany({}),
      SalesRecord.deleteMany({}),
      Form.deleteMany({}),
    ]);
    await disconnectDB();
  });

  it('validates Google Sheets sync env variables and converts escaped \\n in private key', () => {
    assert.throws(
      () => validateGoogleSheetsConfig({ serviceAccountEmail: '' }),
      /Missing env variables: GOOGLE_SERVICE_ACCOUNT_EMAIL/
    );

    const normalized = normalizePrivateKey('LINE1\\nLINE2\\nLINE3');
    assert.equal(normalized, 'LINE1\nLINE2\nLINE3');
  });

  it('syncs 10,000+ rows in 1 API call per sheet using chunked bulkWrite and handles duplicate keys cleanly', async () => {
    let apiCalls = 0;

    // 10,050 customer rows including 50 duplicate IDs + blank rows + varied header names
    const customerMatrix = [
      [
        'Customer ID',
        'C. name',
        'B. name',
        'Channel',
        'CNIC #',
        'NTN #',
        'Mobile #',
        'Address',
        'Days',
        'Credit Limit',
      ],
    ];
    for (let i = 1; i <= 10000; i++) {
      customerMatrix.push([
        `CUST-${String(i).padStart(5, '0')}`,
        `Customer ${i}`,
        `Business ${i}`,
        'Retail',
        `35202-0000000-${i % 10}`,
        `12345-${i % 10}`,
        '0300-1234567',
        `Street ${i}, Lahore`,
        '30',
        String(100000 + i),
      ]);
    }
    // Add 50 duplicate updates & 2 blank/invalid rows
    for (let i = 1; i <= 50; i++) {
      customerMatrix.push([
        `CUST-${String(i).padStart(5, '0')}`,
        `Updated Customer ${i}`,
        `Updated Business ${i}`,
        'Key accounts',
        `35202-0000000-${i % 10}`,
        `12345-${i % 10}`,
        '0300-9999999',
        `Updated Street ${i}`,
        '45',
        '999000',
      ]);
    }
    customerMatrix.push(['', '', '', '', '', '', '', '', '', '']);
    customerMatrix.push(['', 'Missing ID Row', 'No ID', '', '', '', '', '', '', '']);

    // 10,020 sales rows (2,500 customers x 4 months = 10,000 unique pairs + 20 duplicates)
    const salesMatrix = [['Id', 'Month', 'Sales Amount']];
    for (let i = 1; i <= 10000; i++) {
      const custNum = Math.floor((i - 1) / 4) + 1;
      const monthNum = ((i - 1) % 4) + 1;
      const rawPeriod =
        monthNum === 1
          ? 'Jan 2026'
          : monthNum === 2
            ? '2026-02'
            : monthNum === 3
              ? '03/2026'
              : '2026-04-15';
      salesMatrix.push([
        `CUST-${String(custNum).padStart(5, '0')}`,
        rawPeriod,
        `PKR ${i * 100}`,
      ]);
    }
    for (let i = 1; i <= 20; i++) {
      salesMatrix.push([
        `CUST-${String(i).padStart(5, '0')}`,
        '2026-01',
        '777777',
      ]);
    }
    salesMatrix.push(['CUST-00001', 'invalid-date', '500']);

    sheetsSyncService.setSheetsClient({
      spreadsheets: {
        values: {
          async get({ spreadsheetId }) {
            apiCalls += 1;
            if (spreadsheetId === 'mock-customer-sheet') {
              return { data: { values: customerMatrix } };
            }
            return { data: { values: salesMatrix } };
          },
        },
      },
    });

    const mockSheetsCfg = {
      serviceAccountEmail: 'svc@test.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n',
      customerSheetId: 'mock-customer-sheet',
      customerSheetRange: '',
      salesSheetId: 'mock-sales-sheet',
      salesSheetRange: '',
    };

    const summary = await sheetsSyncService.syncFromGoogleSheets(mockSheetsCfg);
    assert.equal(apiCalls, 2);
    assert.equal(summary.customersSynced, 10000);
    assert.equal(summary.salesRecordsSynced, 10000);
    assert.equal(summary.skippedRows, 2);

    const customerCount = await Customer.countDocuments();
    const salesCount = await SalesRecord.countDocuments();
    assert.equal(customerCount, 10000);
    assert.equal(salesCount, 10000);

    // Verify duplicate last-write-wins update applied cleanly
    const updatedCustomer = await Customer.findOne({ customerId: 'CUST-00001' }).lean();
    assert.equal(updatedCustomer.customerName, 'Updated Customer 1');
    assert.equal(updatedCustomer.creditLimit, 999000);

    const updatedSale = await SalesRecord.findOne({
      customerId: 'CUST-00001',
      period: '2026-01',
    }).lean();
    assert.equal(updatedSale.amount, 777777);
    assert.equal(updatedSale.periodSortKey, 202601);

    // Re-running sync a second time must be 100% idempotent with zero duplicate key errors
    const secondRun = await sheetsSyncService.syncFromGoogleSheets(mockSheetsCfg);
    assert.equal(secondRun.customersSynced, 10000);
    assert.equal(secondRun.salesRecordsSynced, 10000);
    assert.equal(await Customer.countDocuments(), 10000);
    assert.equal(await SalesRecord.countDocuments(), 10000);
  });

  it('persists optional customerId on Form model', async () => {
    const form = await Form.create({
      customerId: 'CUST-00001',
      title: 'Updated Customer 1 — Updated Business 1',
      cName: 'Updated Customer 1',
      bName: 'Updated Business 1',
      shopPicture: 'https://pub-c0f18d66c6594793887ffbb5106daeb2.r2.dev/test.png',
      channel: 'Key accounts',
      cnicNo: '35202-0000000-1',
      ntnNo: '12345-1',
      mobileNo: '0300-9999999',
      address: 'Updated Street 1',
      days: '45',
      creditLimit: 999000,
      chequeStatus: 'No',
      creditType: 'New',
    });

    const found = await Form.findOne({ customerId: 'CUST-00001' }).lean();
    assert.ok(found);
    assert.equal(found._id.toString(), form._id.toString());
  });

  it('auto-detects first sheet tab with no column cap, maps common headers (Code, Sales Tax, Contact No), ignores extra columns, and keeps missing Credit Limit as null', async () => {
    const requestedRanges = [];

    sheetsSyncService.setSheetsClient({
      spreadsheets: {
        async get({ spreadsheetId }) {
          return {
            data: {
              sheets: [
                {
                  properties: {
                    title:
                      spreadsheetId === 'dynamic-cust-sheet'
                        ? 'Customer Master'
                        : 'Monthly Sales',
                  },
                },
              ],
            },
          };
        },
        values: {
          async get({ spreadsheetId, range }) {
            requestedRanges.push({ spreadsheetId, range });
            if (spreadsheetId === 'dynamic-cust-sheet') {
              return {
                data: {
                  values: [
                    [
                      'Code',
                      'Customer Name',
                      'Business Name',
                      'Email',
                      'WhatsApp No',
                      'Channel',
                      'CNIC No',
                      'Sales Tax',
                      'Contact No',
                      'Address',
                      'Days',
                      'Internal Notes',
                    ],
                    [
                      'DYN-900',
                      'Ahsan Tariq',
                      'Tariq Enterprises',
                      'ahsan@example.com',
                      '0300-0000000',
                      'W.S',
                      '35202-9009009-1',
                      'ST-998877',
                      '0322-9009009',
                      'Plot 4, Faisalabad',
                      '30',
                      'VIP account',
                    ],
                  ],
                },
              };
            }
            return {
              data: {
                values: [
                  ['Code', 'Month', 'Amount', 'Extra Col'],
                  ['DYN-900', 'Feb 2026', '225000', 'ignored'],
                ],
              },
            };
          },
        },
      },
    });

    // Omit ranges completely to trigger auto-detection of first sheet tab
    const res = await sheetsSyncService.syncFromGoogleSheets({
      serviceAccountEmail: 'svc@test.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n',
      customerSheetId: 'dynamic-cust-sheet',
      customerSheetRange: '',
      salesSheetId: 'dynamic-sales-sheet',
      salesSheetRange: '',
    });

    assert.equal(res.customersSynced, 1);
    assert.equal(res.salesRecordsSynced, 1);
    assert.deepEqual(requestedRanges, [
      { spreadsheetId: 'dynamic-cust-sheet', range: "'Customer Master'" },
      { spreadsheetId: 'dynamic-sales-sheet', range: "'Monthly Sales'" },
    ]);

    // Also verify column limits like "Sheet1!A1:M" are stripped to full tab name "Sheet1"
    assert.equal(sheetsSyncService.formatTabName('Sheet1!A1:M'), 'Sheet1');
    assert.equal(sheetsSyncService.formatTabName('Sales Data!A1:F'), "'Sales Data'");

    const savedCustomer = await Customer.findOne({ customerId: 'DYN-900' }).lean();
    assert.equal(savedCustomer.customerName, 'Ahsan Tariq');
    assert.equal(savedCustomer.businessName, 'Tariq Enterprises');
    assert.equal(savedCustomer.channel, 'W.S');
    assert.equal(savedCustomer.cnic, '35202-9009009-1');
    assert.equal(savedCustomer.ntn, 'ST-998877');
    assert.equal(savedCustomer.mobile, '0322-9009009');
    assert.equal(savedCustomer.address, 'Plot 4, Faisalabad');
    assert.equal(savedCustomer.days, '30');
    assert.equal(savedCustomer.creditLimit, null);
    assert.equal(savedCustomer.email, undefined);
    assert.equal(savedCustomer.whatsAppNo, undefined);
  });

  it('resolves Address Line 1 / Address Line 2 priority cleanly (Line 1 preferred, fallback to Line 2, empty if neither)', async () => {
    await sheetsSyncService.upsertCustomerRows([
      {
        Code: 'ADDR-1',
        'Customer Name': 'Both Present',
        'Address Line 1': 'Primary Line 1',
        'Address Line 2': 'Secondary Line 2',
      },
      {
        Code: 'ADDR-2',
        'Customer Name': 'Only Line 2',
        'Address Line 1': '',
        'Address Line 2': 'Fallback Line 2',
      },
      {
        Code: 'ADDR-3',
        'Customer Name': 'Neither Present',
        'Address Line 1': '',
        'Address Line 2': '',
      },
    ]);

    const c1 = await Customer.findOne({ customerId: 'ADDR-1' }).lean();
    const c2 = await Customer.findOne({ customerId: 'ADDR-2' }).lean();
    const c3 = await Customer.findOne({ customerId: 'ADDR-3' }).lean();

    assert.equal(c1.address, 'Primary Line 1');
    assert.equal(c2.address, 'Fallback Line 2');
    assert.equal(c3.address, '');
  });

  it('auto-discovers Customer and Sales sheets in a Drive folder with pagination and links sales by normalized CNIC or Business Name (ignoring 9999999999999)', async () => {
    let drivePages = 0;

    sheetsSyncService.setDriveClient({
      files: {
        async list({ pageToken }) {
          drivePages += 1;
          if (!pageToken) {
            return {
              data: {
                nextPageToken: 'page-2',
                files: [{ id: 'folder-cust-1', name: 'Customers Master' }],
              },
            };
          }
          return {
            data: {
              files: [{ id: 'folder-sales-1', name: 'FBR Sales Invoices' }],
            },
          };
        },
      },
    });

    sheetsSyncService.setSheetsClient({
      spreadsheets: {
        async get({ spreadsheetId }) {
          return {
            data: {
              sheets: [
                {
                  properties: {
                    title:
                      spreadsheetId === 'folder-cust-1'
                        ? 'Customers'
                        : 'Invoices',
                  },
                },
              ],
            },
          };
        },
        values: {
          async get({ spreadsheetId }) {
            if (spreadsheetId === 'folder-cust-1') {
              return {
                data: {
                  values: [
                    ['Code', 'Customer Name', 'Business Name', 'CNIC No', 'NTN'],
                    ['CUST-A', 'Ali Raza', 'Al-Madina Pharmacy', '35202-1122334-5', ''],
                    ['CUST-B', 'Zafar Iqbal', 'Zafar Medicos', '99999-9999999-9', ''],
                    ['CUST-C', 'Other Buyer', 'Unrelated Store', '99999-9999999-9', ''],
                  ],
                },
              };
            }
            if (spreadsheetId === 'folder-sales-1') {
              return {
                data: {
                  values: [
                    [
                      'User Invoice ID',
                      'Invoice Type',
                      'Invoice Date',
                      'Buyer NTN_CNIC',
                      'Buyer Business Name',
                      'Buyer Province',
                      'Buyer Address',
                      'Total Amount',
                      'Quantity',
                    ],
                    // Matches CUST-A via dash-normalized CNIC
                    [
                      'INV-1001',
                      'Sale Invoice',
                      '2026-01-15',
                      '3520211223345',
                      'Different Name On Invoice',
                      'Punjab',
                      'Lahore',
                      '125000',
                      '10',
                    ],
                    // Placeholder 9999999999999 must NOT match CUST-C; links ONLY to CUST-B by Business Name
                    [
                      'INV-1002',
                      'Sale Invoice',
                      '2026-02-10',
                      '9999999999999',
                      '  zafar medicos ',
                      'Punjab',
                      'Multan',
                      '85000',
                      '5',
                    ],
                  ],
                },
              };
            }
            // Manual CUSTOMER_SHEET_ID fallback source
            return {
              data: {
                values: [
                  ['Code', 'Customer Name', 'Business Name'],
                  ['CUST-MANUAL', 'Manual Entry', 'Manual Hub'],
                ],
              },
            };
          },
        },
      },
    });

    const syncRes = await sheetsSyncService.syncFromGoogleSheets({
      serviceAccountEmail: 'svc@test.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n',
      driveFolderId: 'drive-folder-123',
      customerSheetId: 'manual-cust-sheet',
    });

    assert.equal(drivePages, 2);
    assert.equal(syncRes.customersSynced, 4);
    assert.equal(syncRes.salesRecordsSynced, 2);

    // CUST-A matches INV-1001 via normalized CNIC
    const lookupA = await customerService.getCustomerWithSalesHistory('CUST-A');
    assert.equal(lookupA.summary.totalSales, 125000);
    assert.equal(lookupA.salesHistory[0].period, '2026-01');

    // CUST-B matches INV-1002 via Business Name fallback
    const lookupB = await customerService.getCustomerWithSalesHistory('CUST-B');
    assert.equal(lookupB.summary.totalSales, 85000);
    assert.equal(lookupB.salesHistory[0].period, '2026-02');

    // CUST-C also has 99999-9999999-9 placeholder CNIC, must NOT receive CUST-B's invoice
    const lookupC = await customerService.getCustomerWithSalesHistory('CUST-C');
    assert.equal(lookupC.summary.totalSales, 0);
    assert.equal(lookupC.salesHistory.length, 0);
  });
});
