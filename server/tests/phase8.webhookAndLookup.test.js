const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../app');
const { config } = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const Customer = require('../models/Customer');
const SalesRecord = require('../models/SalesRecord');
const sheetsSyncService = require('../services/sheetsSyncService');
const { generateRoleToken } = require('../services/authService');

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/sana_approval_test_phase8_api';

function cookieForRole(role) {
  return `token=${generateRoleToken(role)}`;
}

describe('Phase 2 (Sheets API): Webhook Security, Manual Sync RBAC & Customer Lookup API', () => {
  before(async () => {
    await connectDB(TEST_DB_URI);
    await Promise.all([Customer.deleteMany({}), SalesRecord.deleteMany({})]);
  });

  after(async () => {
    sheetsSyncService.setSheetsClient(null);
    sheetsSyncService.setDriveClient(null);
    await Promise.all([Customer.deleteMany({}), SalesRecord.deleteMany({})]);
    await disconnectDB();
  });

  it('rejects missing or invalid X-Webhook-Secret with 401 (timing-safe)', async () => {
    const missingRes = await request(app)
      .post('/api/webhooks/sheets')
      .send({ type: 'customer', rows: [{ customerId: 'C-1' }] });
    assert.equal(missingRes.status, 401);

    const wrongRes = await request(app)
      .post('/api/webhooks/sheets')
      .set('X-Webhook-Secret', 'wrong-secret-value')
      .send({ type: 'customer', rows: [{ customerId: 'C-1' }] });
    assert.equal(wrongRes.status, 401);
  });

  it('sanitizes NoSQL injection payloads on webhook and lookup routes', async () => {
    // Injection attempt inside webhook body
    const webhookRes = await request(app)
      .post('/api/webhooks/sheets')
      .set('X-Webhook-Secret', config.sheets.webhookSecret)
      .send({
        type: 'customer',
        rows: [
          {
            customerId: { $ne: '' },
            $where: '1==1',
            customerName: 'Evil',
          },
        ],
      });
    assert.equal(webhookRes.status, 200);
    assert.equal(webhookRes.body.synced, 0);
    assert.equal(webhookRes.body.skipped, 1);

    // Injection attempt on lookup param
    const lookupRes = await request(app)
      .get('/api/customers/$ne')
      .set('Cookie', cookieForRole(1));
    assert.equal(lookupRes.status, 400);
  });

  it('enforces RBAC: blocks Persons 2-4 from POST /api/sheets/sync and allows Person 1', async () => {
    for (const role of [2, 3, 4]) {
      const res = await request(app)
        .post('/api/sheets/sync')
        .set('Cookie', cookieForRole(role));
      assert.equal(res.status, 403);
    }

    sheetsSyncService.setDriveClient({
      files: {
        async list() {
          return {
            data: {
              files: [
                { id: 'mock-customer-sheet', name: 'Customers' },
                { id: 'mock-sales-sheet', name: 'Sales' },
              ],
            },
          };
        },
      },
    });

    sheetsSyncService.setSheetsClient({
      spreadsheets: {
        values: {
          async get({ spreadsheetId }) {
            if (
              spreadsheetId === config.sheets.customerSheetId ||
              spreadsheetId === 'mock-customer-sheet'
            ) {
              return {
                data: {
                  values: [
                    ['Customer ID', 'Customer Name', 'Business Name', 'Channel', 'Credit Limit'],
                    ['CUST-SYNC-1', 'Saeed', 'Saeed Traders', 'S.D', '450000'],
                  ],
                },
              };
            }
            return {
              data: {
                values: [
                  ['User Invoice ID', 'Invoice Date', 'Buyer NTN_CNIC', 'Total Amount'],
                  ['INV-SYNC-1', '2026-01-15', '3520211112223', '120000'],
                ],
              },
            };
          },
        },
      },
    });

    const p1Res = await request(app)
      .post('/api/sheets/sync')
      .set('Cookie', cookieForRole(1));
    assert.equal(p1Res.status, 200);
    assert.equal(p1Res.body.customersSynced, 1);
    assert.equal(p1Res.body.salesRecordsSynced, 1);

    // Async mode returns 202 immediately and completes in background
    const asyncRes = await request(app)
      .post('/api/sheets/sync?async=1')
      .set('Cookie', cookieForRole(1));
    assert.equal(asyncRes.status, 202);
    assert.equal(asyncRes.body.status, 'running');

    let statusBody = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 25));
      const statusRes = await request(app)
        .get('/api/sheets/sync/status')
        .set('Cookie', cookieForRole(1));
      assert.equal(statusRes.status, 200);
      statusBody = statusRes.body;
      if (statusBody.status === 'completed' || statusBody.status === 'failed') {
        break;
      }
    }
    assert.equal(statusBody.status, 'completed');
    assert.equal(statusBody.result.customersSynced, 1);
    assert.equal(statusBody.result.salesRecordsSynced, 1);
  });

  it('upserts both customer and sales rows via webhook and returns chronologically sorted history on lookup', async () => {
    const custWebhook = await request(app)
      .post('/api/webhooks/sheets')
      .set('X-Webhook-Secret', config.sheets.webhookSecret)
      .send({
        type: 'customer',
        rows: [
          {
            'Customer ID': 'CUST-777',
            'C name': 'Imran Siddiqui',
            'B name': 'Siddiqui Pharma',
            Channel: 'Key accounts',
            CNIC: '35202-7777777-1',
            NTN: '7777777-8',
            Mobile: '0300-7777777',
            Address: 'Main Shahrah-e-Quaid, Lahore',
            Days: '45',
            'Credit Limit': '850,000',
          },
        ],
      });
    assert.equal(custWebhook.status, 200);
    assert.equal(custWebhook.body.synced, 1);

    // Push sales records intentionally out of chronological order
    const salesWebhook = await request(app)
      .post('/api/webhooks/sheets')
      .set('X-Webhook-Secret', config.sheets.webhookSecret)
      .send({
        type: 'sales',
        rows: [
          { customerId: 'CUST-777', period: 'Mar 2026', amount: '300000' },
          { customerId: 'CUST-777', period: 'Jan 2026', amount: '100000' },
          { customerId: 'CUST-777', period: '2026-02', amount: '200000' },
        ],
      });
    assert.equal(salesWebhook.status, 200);
    assert.equal(salesWebhook.body.synced, 3);

    // Unauthenticated lookup rejected with 401
    const unauthRes = await request(app).get('/api/customers/CUST-777');
    assert.equal(unauthRes.status, 401);

    // Missing customer returns 404 cleanly
    const notFoundRes = await request(app)
      .get('/api/customers/DOES-NOT-EXIST')
      .set('Cookie', cookieForRole(2));
    assert.equal(notFoundRes.status, 404);

    // Authenticated lookup (any role 1-4) returns customer + chronologically sorted sales + summary
    for (const role of [1, 2, 3, 4]) {
      const lookupRes = await request(app)
        .get('/api/customers/CUST-777')
        .set('Cookie', cookieForRole(role));

      assert.equal(lookupRes.status, 200);
      assert.equal(lookupRes.body.customer.customerName, 'Imran Siddiqui');
      assert.equal(lookupRes.body.customer.businessName, 'Siddiqui Pharma');
      assert.equal(lookupRes.body.customer.creditLimit, 850000);
      assert.deepEqual(
        lookupRes.body.salesHistory.map((s) => s.period),
        ['2026-01', '2026-02', '2026-03']
      );
      assert.deepEqual(lookupRes.body.summary, {
        totalSales: 600000,
        averageSales: 200000,
        monthsCount: 3,
      });
    }
  });
});
