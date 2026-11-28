const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../app');
const { config } = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const Form = require('../models/Form');

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/sana_approval_test_phase4_e2e';
const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function loginAsPerson(personNumber) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ passkey: config.passkeys[personNumber] });

  assert.equal(res.status, 200);
  assert.equal(res.body.role, personNumber);
  const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
  assert.ok(cookie);
  return cookie;
}

describe('Phase 4 End-to-End: Complete 4-Person Sequential Approval & Edit-Reset Lifecycle', () => {
  before(async () => {
    await connectDB(TEST_DB_URI);
    await Form.deleteMany({});
  });

  after(async () => {
    await Form.deleteMany({});
    await disconnectDB();
  });

  it('completes the full 4-person passkey login, 12-field creation, edit-reset, and stage 2->3->4->5 approval flow', async () => {
    const p1Cookie = await loginAsPerson(1);
    const p2Cookie = await loginAsPerson(2);
    const p3Cookie = await loginAsPerson(3);
    const p4Cookie = await loginAsPerson(4);

    // 1. Person 1 creates a form with exact fields (Cheque status: N)
    const createRes = await request(app)
      .post('/api/forms')
      .set('Cookie', p1Cookie)
      .send({
        cName: 'Usman Ali',
        bName: 'Sana Key Accounts Hub',
        shopPicture: SAMPLE_PNG_DATA_URL,
        channel: 'Key accounts',
        cnicNo: '42101-7654321-3',
        ntnNo: '8877665-1',
        mobileNo: '0321-9876543',
        address: 'Suite 9, Shahrah-e-Faisal, Karachi',
        days: '45',
        creditLimit: 1200000,
        chequeStatus: 'No',
        creditType: 'New',
      });
    assert.equal(createRes.status, 201);
    const formId = createRes.body.form._id;
    assert.equal(createRes.body.form.currentStage, 2);
    assert.equal(createRes.body.form.status, 'INCOMPLETE');

    // 2. Person 1 edits BEFORE Person 2 approves (Cheque status = Yes -> allowed at Stage 2)
    const p1Edit = await request(app)
      .put(`/api/forms/${formId}`)
      .set('Cookie', p1Cookie)
      .send({
        cName: 'Usman Ali',
        bName: 'Sana Key Accounts Hub',
        shopPicture: SAMPLE_PNG_DATA_URL,
        channel: 'Key accounts',
        cnicNo: '42101-7654321-3',
        ntnNo: '8877665-1',
        mobileNo: '0321-9876543',
        address: 'Suite 9, Shahrah-e-Faisal, Karachi',
        days: '60',
        creditLimit: 1500000,
        chequeStatus: 'Yes',
        chequeNo: 'CHQ-771234',
        chequeAmount: 1500000,
        chequePicture: SAMPLE_PNG_DATA_URL,
        bankName: 'MCB Bank',
        bankBranch: 'Shahrah-e-Faisal',
        creditType: 'Increment',
      });
    assert.equal(p1Edit.status, 200);
    assert.equal(p1Edit.body.form.currentStage, 2);
    assert.equal(p1Edit.body.form.status, 'INCOMPLETE');
    assert.equal(p1Edit.body.form.isUpdated, true);
    assert.equal(p1Edit.body.form.comments.length, 0);
    assert.equal(p1Edit.body.form.chequeStatus, 'Yes');
    assert.equal(p1Edit.body.form.chequeNo, 'CHQ-771234');

    // 3. Person 2 approves form (Stage 2 -> 3) -> P1 edit/delete is now locked (403)
    const p2Review = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', p2Cookie)
      .send({
        action: 'APPROVE',
        comment: 'Person 2 verified security cheque image.',
      });
    assert.equal(p2Review.status, 200);
    assert.equal(p2Review.body.form.currentStage, 3);

    const p1LockedEdit = await request(app)
      .put(`/api/forms/${formId}`)
      .set('Cookie', p1Cookie)
      .send({
        cName: 'Usman Ali',
        bName: 'Sana Key Accounts Hub',
        shopPicture: SAMPLE_PNG_DATA_URL,
        channel: 'Key accounts',
        cnicNo: '42101-7654321-3',
        mobileNo: '0321-9876543',
        address: 'Suite 9, Shahrah-e-Faisal, Karachi',
        days: '60',
        creditLimit: 1500000,
        chequeStatus: 'No',
        creditType: 'Increment',
      });
    assert.equal(p1LockedEdit.status, 403);

    const p1LockedDelete = await request(app)
      .delete(`/api/forms/${formId}`)
      .set('Cookie', p1Cookie);
    assert.equal(p1LockedDelete.status, 403);

    // 5. Person 3 approves (Stage 3 -> 4)
    const p3Review = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', p3Cookie)
      .send({
        action: 'APPROVE',
        comment: 'Person 3 confirmed 60-day credit terms.',
      });
    assert.equal(p3Review.status, 200);
    assert.equal(p3Review.body.form.currentStage, 4);

    // 6. Person 4 gives final approval (Stage 4 -> 5, status -> APPROVED)
    const p4Review = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', p4Cookie)
      .send({
        action: 'APPROVE',
        comment: 'Person 4 final sign-off granted.',
      });
    assert.equal(p4Review.status, 200);
    assert.equal(p4Review.body.form.currentStage, 5);
    assert.equal(p4Review.body.form.status, 'APPROVED');
    assert.equal(p4Review.body.form.comments.length, 3);
    assert.deepEqual(
      p4Review.body.form.comments.map((c) => c.role),
      [2, 3, 4]
    );
  });
});
