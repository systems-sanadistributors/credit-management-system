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

    // Person 2 approves (Stage 2 -> 3)
    const p2Approve = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(2))
      .send({ action: 'APPROVE', comment: 'Shop picture and CNIC verified.' });
    assert.equal(p2Approve.status, 200);
    assert.equal(p2Approve.body.form.currentStage, 3);

    // Person 1 edits the form -> resets to Stage 2, clears prior approvals, sets isUpdated: true
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

    // Walk through Person 2 -> Person 3 -> Person 4
    await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(2))
      .send({ action: 'APPROVE', comment: 'Cheque CHQ-4410 verified.' });

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
});
