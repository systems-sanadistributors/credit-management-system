const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Form = require('../models/Form');
const { generateRoleToken } = require('../services/authService');

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/sana_approval_test_phase2';
const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function cookieForRole(role) {
  return `token=${generateRoleToken(role)}`;
}

function buildValidPayload(overrides = {}) {
  return {
    cName: 'Tariq Mahmood',
    bName: 'Al-Noor Pharmacy',
    shopPicture: SAMPLE_PNG_DATA_URL,
    channel: 'Retail',
    cnicNo: '35202-1234567-1',
    ntnNo: '4455667-8',
    mobileNo: '0300-1234567',
    address: 'Plot 14, Main Boulevard, Lahore',
    days: '30',
    creditLimit: 500000,
    chequeStatus: 'No',
    creditType: 'New',
    ...overrides,
  };
}

describe('Phase 2: Structured 12-Field Form CRUD, Conditional Cheque Validation, Sequential Stages & RBAC', () => {
  before(async () => {
    await connectDB(TEST_DB_URI);
    await Form.deleteMany({});
  });

  after(async () => {
    await Form.deleteMany({});
    await disconnectDB();
  });

  it('blocks Persons 2, 3, 4, and Viewer (role 5) from mutating forms while allowing Viewer read-only access', async () => {
    for (const role of [2, 3, 4, 5]) {
      const createRes = await request(app)
        .post('/api/forms')
        .set('Cookie', cookieForRole(role))
        .send(buildValidPayload());
      assert.equal(createRes.status, 403);
    }

    const p1Create = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(buildValidPayload());
    assert.equal(p1Create.status, 201);
    const id = p1Create.body.form._id;

    const viewerList = await request(app)
      .get('/api/forms')
      .set('Cookie', cookieForRole(5));
    assert.equal(viewerList.status, 200);
    assert.ok(viewerList.body.forms.some((f) => f._id === id));

    const viewerGet = await request(app)
      .get(`/api/forms/${id}`)
      .set('Cookie', cookieForRole(5));
    assert.equal(viewerGet.status, 200);

    const viewerUpdate = await request(app)
      .put(`/api/forms/${id}`)
      .set('Cookie', cookieForRole(5))
      .send(buildValidPayload());
    assert.equal(viewerUpdate.status, 403);

    const viewerDelete = await request(app)
      .delete(`/api/forms/${id}`)
      .set('Cookie', cookieForRole(5));
    assert.equal(viewerDelete.status, 403);

    const viewerReview = await request(app)
      .post(`/api/forms/${id}/review`)
      .set('Cookie', cookieForRole(5))
      .send({ action: 'APPROVE', comment: 'Should be forbidden' });
    assert.equal(viewerReview.status, 403);

    const viewerSendCredit = await request(app)
      .post(`/api/forms/${id}/send-credit`)
      .set('Cookie', cookieForRole(5));
    assert.equal(viewerSendCredit.status, 403);

    await Form.deleteMany({});
  });

  it('validates conditional cheque fields when chequeStatus is Y and rejects unsafe image types', async () => {
    const missingChequeRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(buildValidPayload({ chequeStatus: 'Yes' }));
    assert.equal(missingChequeRes.status, 400);

    const svgRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(
        buildValidPayload({
          shopPicture: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        })
      );
    assert.equal(svgRes.status, 400);

    const missingBankNameRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(
        buildValidPayload({
          chequeStatus: 'Yes',
          chequeNo: 'CHQ-99812',
          chequeAmount: 250000,
          chequePicture: SAMPLE_PNG_DATA_URL,
        })
      );
    assert.equal(missingBankNameRes.status, 400);

    const validWithCheque = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(
        buildValidPayload({
          chequeStatus: 'Yes',
          chequeNo: 'CHQ-99812',
          chequeAmount: 250000,
          chequePicture: SAMPLE_PNG_DATA_URL,
          bankName: 'HBL',
          bankBranch: 'Gulberg Branch',
        })
      );
    assert.equal(validWithCheque.status, 201);
    assert.equal(validWithCheque.body.form.chequeStatus, 'Yes');
    assert.equal(validWithCheque.body.form.chequeNo, 'CHQ-99812');
    assert.equal(validWithCheque.body.form.chequeAmount, 250000);
    assert.equal(validWithCheque.body.form.bankName, 'HBL');
    assert.equal(validWithCheque.body.form.bankBranch, 'Gulberg Branch');
    assert.equal(validWithCheque.body.form.currentStage, 2);
    assert.equal(validWithCheque.body.form.status, 'INCOMPLETE');
  });

  it('accepts a form when NTN # is omitted or blank', async () => {
    const payloadWithoutNtn = buildValidPayload();
    delete payloadWithoutNtn.ntnNo;

    const omittedRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(payloadWithoutNtn);
    assert.equal(omittedRes.status, 201);
    assert.equal(omittedRes.body.form.ntnNo || '', '');

    const blankRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(buildValidPayload({ cName: 'Blank NTN', ntnNo: '   ' }));
    assert.equal(blankRes.status, 201);
    assert.equal(blankRes.body.form.ntnNo, '');

    await Form.deleteMany({
      _id: { $in: [omittedRes.body.form._id, blankRes.body.form._id] },
    });
  });

  it('enforces sequential stage gates, resets on Person 1 edit, and reaches APPROVED at Stage 5', async () => {
    const createRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(buildValidPayload({ cName: 'Bilal Khan', bName: 'Khan Medicos' }));
    const formId = createRes.body.form._id;

    // Person 3 cannot review while at Stage 2
    const p3Early = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(3))
      .send({ action: 'APPROVE', comment: 'Skipping Person 2' });
    assert.equal(p3Early.status, 403);

    // Person 1 edits BEFORE Person 2 approves -> allowed at Stage 2, sets isUpdated: true
    const editRes = await request(app)
      .put(`/api/forms/${formId}`)
      .set('Cookie', cookieForRole(1))
      .send(
        buildValidPayload({
          cName: 'Bilal Khan',
          bName: 'Khan Medicos',
          creditLimit: 750000,
          creditType: 'Increment',
          chequeStatus: 'Yes',
          chequeNo: 'CHQ-4410',
          chequeAmount: 750000,
          chequePicture: SAMPLE_PNG_DATA_URL,
          bankName: 'Meezan Bank',
        })
      );
    assert.equal(editRes.status, 200);
    assert.equal(editRes.body.form.currentStage, 2);
    assert.equal(editRes.body.form.status, 'INCOMPLETE');
    assert.equal(editRes.body.form.isUpdated, true);
    assert.equal(editRes.body.form.comments.length, 0);
    assert.equal(editRes.body.form.creditLimit, 750000);

    // Person 2 approves (Stage 2 -> 3) -> locks P1 edit & delete
    const p2Approve = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(2))
      .send({ action: 'APPROVE', comment: 'Cheque CHQ-4410 verified.' });
    assert.equal(p2Approve.status, 200);
    assert.equal(p2Approve.body.form.currentStage, 3);

    const lockedEditRes = await request(app)
      .put(`/api/forms/${formId}`)
      .set('Cookie', cookieForRole(1))
      .send(buildValidPayload({ cName: 'Bilal Khan', bName: 'Khan Medicos' }));
    assert.equal(lockedEditRes.status, 403);

    const lockedDeleteRes = await request(app)
      .delete(`/api/forms/${formId}`)
      .set('Cookie', cookieForRole(1));
    assert.equal(lockedDeleteRes.status, 403);

    // Walk through Person 3 -> Person 4
    await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(3))
      .send({ action: 'APPROVE', comment: 'NTN and channel confirmed.' });

    const p4Final = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(4))
      .send({ action: 'APPROVE', comment: 'Final credit increment approved.' });

    assert.equal(p4Final.status, 200);
    assert.equal(p4Final.body.form.currentStage, 5);
    assert.equal(p4Final.body.form.status, 'APPROVED');
    assert.equal(p4Final.body.form.comments.length, 3);
  });

  it('locks a form when rejected and returns accurate dashboard stat counts', async () => {
    const createRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(buildValidPayload({ cName: 'Zainab', bName: 'City Traders' }));
    const formId = createRes.body.form._id;

    const rejectRes = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(2))
      .send({
        action: 'REJECT',
        comment: 'Shop picture is blurry.',
      });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.form.status, 'REJECTED');

    const lockedRes = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(2))
      .send({ action: 'APPROVE', comment: 'Trying after rejection' });
    assert.equal(lockedRes.status, 400);

    const listRes = await request(app)
      .get('/api/forms')
      .set('Cookie', cookieForRole(4));
    assert.equal(listRes.status, 200);
    assert.deepEqual(listRes.body.stats, {
      total: 3,
      incomplete: 1,
      completed: 1,
      approved: 1,
      rejected: 1,
    });

    const delRes = await request(app)
      .delete(`/api/forms/${formId}`)
      .set('Cookie', cookieForRole(1));
    assert.equal(delRes.status, 200);
  });

  it('exports existing customer forms to Excel (.xlsx) with all fields, --- fallbacks, P1-P4 statuses, and embedded images', async () => {
    const ExcelJS = require('exceljs');
    const binaryParser = (res, callback) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    };

    const blankRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(
        buildValidPayload({
          cName: 'Export Blank Check',
          bName: 'Blank Check Store',
          ntnNo: '',
          chequeStatus: 'No',
        })
      );
    assert.equal(blankRes.status, 201);
    const blankId = blankRes.body.form._id;

    try {
      // Unauthenticated should return 401
      const unauthRes = await request(app).get('/api/forms/export');
      assert.equal(unauthRes.status, 401);

      // Viewer (role 5) should be allowed to export existing forms
      const exportRes = await request(app)
        .get('/api/forms/export')
        .set('Cookie', cookieForRole(5))
        .buffer(true)
        .parse(binaryParser);

      assert.equal(exportRes.status, 200);
      assert.match(
        exportRes.headers['content-type'],
        /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/
      );
      assert.ok(Buffer.isBuffer(exportRes.body) && exportRes.body.length > 0);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(exportRes.body);
      const sheet = workbook.getWorksheet('Customers Export');
      assert.ok(sheet);

      const headers = sheet.getRow(1).values.slice(1);
      assert.ok(headers.includes('Customer Name'));
      assert.ok(headers.includes('NTN #'));
      assert.ok(headers.includes('Bank Name'));
      assert.ok(headers.includes('Approval / Rejection'));
      assert.ok(headers.includes('P1 Status'));
      assert.ok(headers.includes('P2 Status'));
      assert.ok(headers.includes('P3 Status'));
      assert.ok(headers.includes('P4 Status'));
      assert.ok(headers.includes('Shop Picture'));
      assert.ok(headers.includes('Cheque Picture'));

      let foundApprovedRow = false;
      let foundBlankFallbackRow = false;
      const cNameCol = headers.indexOf('Customer Name') + 1;
      const ntnCol = headers.indexOf('NTN #') + 1;
      const chequeNoCol = headers.indexOf('Cheque #') + 1;
      const bankNameCol = headers.indexOf('Bank Name') + 1;
      const bankBranchCol = headers.indexOf('Bank Branch') + 1;
      const chequePicCol = headers.indexOf('Cheque Picture') + 1;
      const approvalCol = headers.indexOf('Approval / Rejection') + 1;
      const p1Col = headers.indexOf('P1 Status') + 1;
      const p2Col = headers.indexOf('P2 Status') + 1;
      const p4Col = headers.indexOf('P4 Status') + 1;

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        if (row.getCell(approvalCol).value === 'APPROVED') {
          foundApprovedRow = true;
          assert.equal(row.getCell(p1Col).value, 'Submitted (Updated / Reset)');
          assert.match(String(row.getCell(p2Col).value), /^APPROVED:/);
          assert.match(String(row.getCell(p4Col).value), /^APPROVED:/);
          assert.equal(row.getCell(chequeNoCol).value, 'CHQ-4410');
        }
        if (row.getCell(cNameCol).value === 'Export Blank Check') {
          foundBlankFallbackRow = true;
          assert.equal(row.getCell(ntnCol).value, '---');
          assert.equal(row.getCell(chequeNoCol).value, '---');
          assert.equal(row.getCell(bankNameCol).value, '---');
          assert.equal(row.getCell(bankBranchCol).value, '---');
          assert.equal(row.getCell(chequePicCol).value, '---');
          assert.equal(row.getCell(p1Col).value, 'Submitted');
          assert.equal(row.getCell(p2Col).value, 'Pending Review');
        }
      });
      assert.equal(foundApprovedRow, true);
      assert.equal(foundBlankFallbackRow, true);
      assert.ok(sheet.getImages().length > 0);
    } finally {
      await Form.findByIdAndDelete(blankId);
    }
  });
});
