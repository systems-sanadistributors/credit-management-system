const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../app');
const { config } = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const Form = require('../models/Form');
const emailService = require('../services/emailService');
const { generateRoleToken } = require('../services/authService');

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/sana_approval_test_phase5_email';
const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function cookieForRole(role) {
  return `token=${generateRoleToken(role)}`;
}

function buildValidPayload(overrides = {}) {
  return {
    cName: 'Hassan Raza',
    bName: 'Raza Logistics',
    shopPicture: SAMPLE_PNG_DATA_URL,
    channel: 'S.D',
    cnicNo: '35201-9988776-5',
    ntnNo: '7766554-3',
    mobileNo: '0301-7778899',
    address: 'Plot 5, Industrial Estate, Multan',
    days: '30',
    creditLimit: 400000,
    chequeStatus: 'No',
    creditType: 'New',
    ...overrides,
  };
}

describe('Phase 5: Nodemailer Sequential & Broadcast Email Notifications', () => {
  const sentEmails = [];

  before(async () => {
    await connectDB(TEST_DB_URI);
    await Form.deleteMany({});
    emailService.setTransporter({
      async sendMail(mailOptions) {
        sentEmails.push(mailOptions);
        return { messageId: `mock-${sentEmails.length}` };
      },
    });
  });

  beforeEach(() => {
    sentEmails.length = 0;
  });

  after(async () => {
    emailService.setTransporter(null);
    await Form.deleteMany({});
    await disconnectDB();
  });

  it('notifies next person in sequence (P1->P2, P2->P3 on approve & reject, P3->P4, P4->P1) with comment and system link', async () => {
    // 1. Person 1 creates form -> emails Person 2
    const createRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(buildValidPayload());
    assert.equal(createRes.status, 201);
    const formId = createRes.body.form._id;

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, config.emails[2]);
    assert.ok(sentEmails[0].text.includes(config.clientUrl));
    assert.ok(sentEmails[0].html.includes(config.clientUrl));

    // 2. Person 2 approves with comment -> emails Person 3 with comment + link
    const p2Res = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(2))
      .send({ action: 'APPROVE', comment: 'CNIC and shop front verified.' });
    assert.equal(p2Res.status, 200);

    assert.equal(sentEmails.length, 2);
    assert.equal(sentEmails[1].to, config.emails[3]);
    assert.match(sentEmails[1].subject, /APPROVED by Person 2/);
    assert.ok(sentEmails[1].text.includes('CNIC and shop front verified.'));
    assert.ok(sentEmails[1].html.includes(config.clientUrl));

    // 3. Person 3 approves -> emails Person 4
    const p3Res = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(3))
      .send({ action: 'APPROVE', comment: 'Credit days 30 confirmed.' });
    assert.equal(p3Res.status, 200);

    assert.equal(sentEmails.length, 3);
    assert.equal(sentEmails[2].to, config.emails[4]);
    assert.match(sentEmails[2].subject, /APPROVED by Person 3/);
    assert.ok(sentEmails[2].text.includes('Credit days 30 confirmed.'));

    // 4. Person 4 approves -> emails Person 1
    const p4Res = await request(app)
      .post(`/api/forms/${formId}/review`)
      .set('Cookie', cookieForRole(4))
      .send({ action: 'APPROVE', comment: 'Final approval granted.' });
    assert.equal(p4Res.status, 200);

    assert.equal(sentEmails.length, 4);
    assert.equal(sentEmails[3].to, config.emails[1]);
    assert.match(sentEmails[3].subject, /APPROVED by Person 4/);
    assert.ok(sentEmails[3].text.includes('Final approval granted.'));

    // 4b. Person 4 clicks "Send Credit" -> sends full credit details to PERSON5_EMAIL
    const p3Blocked = await request(app)
      .post(`/api/forms/${formId}/send-credit`)
      .set('Cookie', cookieForRole(3));
    assert.equal(p3Blocked.status, 403);

    const sendCreditRes = await request(app)
      .post(`/api/forms/${formId}/send-credit`)
      .set('Cookie', cookieForRole(4));
    assert.equal(sendCreditRes.status, 200);
    assert.ok(sendCreditRes.body.form.creditSentAt);

    assert.equal(sentEmails.length, 5);
    assert.equal(sentEmails[4].to, config.emails[5]);
    assert.match(sentEmails[4].subject, /Approved Credit Package/);
    assert.ok(sentEmails[4].text.includes('Hassan Raza'));
    assert.ok(sentEmails[4].text.includes('400,000'));
    assert.ok(sentEmails[4].text.includes('Final approval granted.'));

    // 5. Create another form and verify Person 2 REJECT also notifies Person 3 with comment + link
    const createRes2 = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(buildValidPayload({ cName: 'Reject Test', bName: 'Test Store' }));
    const form2Id = createRes2.body.form._id;

    const p2Reject = await request(app)
      .post(`/api/forms/${form2Id}/review`)
      .set('Cookie', cookieForRole(2))
      .send({
        action: 'REJECT',
        comment: 'Address incomplete <script>alert(1)</script>',
      });
    assert.equal(p2Reject.status, 200);

    const rejectMail = sentEmails[sentEmails.length - 1];
    assert.equal(rejectMail.to, config.emails[3]);
    assert.match(rejectMail.subject, /REJECTED by Person 2/);
    assert.ok(rejectMail.text.includes('Address incomplete'));
    assert.ok(!rejectMail.html.includes('<script>'));
    assert.ok(rejectMail.html.includes('&lt;script&gt;'));
  });

  it('notifies all 3 checkers (Persons 2, 3, and 4) when Person 1 edits or deletes a form', async () => {
    const createRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .send(buildValidPayload({ cName: 'Broadcast Check', bName: 'Delta Mart' }));
    const formId = createRes.body.form._id;
    sentEmails.length = 0;

    // Person 1 edits -> all 3 checkers receive email
    const editRes = await request(app)
      .put(`/api/forms/${formId}`)
      .set('Cookie', cookieForRole(1))
      .send(buildValidPayload({ cName: 'Broadcast Check', bName: 'Delta Mart Rev 2', creditLimit: 600000 }));
    assert.equal(editRes.status, 200);

    assert.equal(sentEmails.length, 1);
    const expectedAllThree = [config.emails[2], config.emails[3], config.emails[4]].join(', ');
    assert.equal(sentEmails[0].to, expectedAllThree);
    assert.match(sentEmails[0].subject, /Edited by Person 1/);
    assert.ok(sentEmails[0].html.includes(config.clientUrl));

    // Person 1 deletes -> all 3 checkers receive email
    const deleteRes = await request(app)
      .delete(`/api/forms/${formId}`)
      .set('Cookie', cookieForRole(1));
    assert.equal(deleteRes.status, 200);

    assert.equal(sentEmails.length, 2);
    assert.equal(sentEmails[1].to, expectedAllThree);
    assert.match(sentEmails[1].subject, /Deleted by Person 1/);
    assert.ok(sentEmails[1].html.includes(config.clientUrl));
  });
});
