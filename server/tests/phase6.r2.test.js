const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { app } = require('../app');
const { config } = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const Form = require('../models/Form');
const r2Service = require('../services/r2Service');
const { generateRoleToken } = require('../services/authService');

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/sana_approval_test_phase6_r2';
const SAMPLE_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function cookieForRole(role) {
  return `token=${generateRoleToken(role)}`;
}

describe('Phase 6: Cloudflare R2 Image Upload (S3Client + Multer memoryStorage)', () => {
  const s3Commands = [];

  before(async () => {
    await connectDB(TEST_DB_URI);
    await Form.deleteMany({});
    r2Service.setS3Client({
      async send(command) {
        s3Commands.push(command);
        return { ETag: '"mock-etag"' };
      },
    });
  });

  beforeEach(() => {
    s3Commands.length = 0;
  });

  after(async () => {
    r2Service.setS3Client(null);
    await Form.deleteMany({});
    await disconnectDB();
  });

  it('uploads Shop Picture and Cheque Picture via multipart/form-data to R2 with UUID keys and stores public URLs', async () => {
    const res = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .field('cName', 'Kashif')
      .field('bName', 'Kashif Super Store')
      .field('channel', 'Retail')
      .field('cnicNo', '35202-1111222-3')
      .field('ntnNo', '9988776-5')
      .field('mobileNo', '0300-5556677')
      .field('address', 'Main Market, Gulberg')
      .field('days', '30')
      .field('creditLimit', '500000')
      .field('chequeStatus', 'Yes')
      .field('chequeNo', 'CHQ-1001')
      .field('chequeAmount', '500000')
      .field('bankName', 'UBL')
      .field('creditType', 'New')
      .attach('shopPicture', SAMPLE_PNG_BUFFER, {
        filename: 'shop.png',
        contentType: 'image/png',
      })
      .attach('chequePicture', SAMPLE_PNG_BUFFER, {
        filename: 'cheque.jpg',
        contentType: 'image/jpeg',
      });

    assert.equal(res.status, 201);
    assert.equal(s3Commands.length, 2);

    assert.ok(s3Commands[0] instanceof PutObjectCommand);
    assert.equal(s3Commands[0].input.Bucket, config.r2.bucketName);
    assert.equal(s3Commands[0].input.ContentType, 'image/png');
    assert.ok(Buffer.isBuffer(s3Commands[0].input.Body));
    assert.match(
      s3Commands[0].input.Key,
      /^sana-distribution\/shops\/[0-9a-f-]{36}\.png$/
    );

    assert.ok(s3Commands[1] instanceof PutObjectCommand);
    assert.equal(s3Commands[1].input.Bucket, config.r2.bucketName);
    assert.equal(s3Commands[1].input.ContentType, 'image/jpeg');
    assert.match(
      s3Commands[1].input.Key,
      /^sana-distribution\/cheques\/[0-9a-f-]{36}\.jpg$/
    );

    assert.equal(
      res.body.form.shopPicture,
      `${config.r2.publicUrl}/${s3Commands[0].input.Key}`
    );
    assert.equal(
      res.body.form.chequePicture,
      `${config.r2.publicUrl}/${s3Commands[1].input.Key}`
    );

    // Editing without replacing existing R2 URLs should preserve them without re-uploading
    s3Commands.length = 0;
    const editRes = await request(app)
      .put(`/api/forms/${res.body.form._id}`)
      .set('Cookie', cookieForRole(1))
      .field('cName', 'Kashif')
      .field('bName', 'Kashif Super Store')
      .field('channel', 'Retail')
      .field('cnicNo', '35202-1111222-3')
      .field('ntnNo', '9988776-5')
      .field('mobileNo', '0300-5556677')
      .field('address', 'Main Market, Gulberg')
      .field('days', '45')
      .field('creditLimit', '650000')
      .field('chequeStatus', 'Yes')
      .field('chequeNo', 'CHQ-1001')
      .field('chequeAmount', '650000')
      .field('bankName', 'UBL')
      .field('bankBranch', 'Main Market')
      .field('creditType', 'Increment')
      .field('shopPicture', res.body.form.shopPicture)
      .field('chequePicture', res.body.form.chequePicture);

    assert.equal(editRes.status, 200);
    assert.equal(s3Commands.length, 0);
    assert.equal(editRes.body.form.shopPicture, res.body.form.shopPicture);
    assert.equal(editRes.body.form.chequePicture, res.body.form.chequePicture);
  });

  it('rejects unsupported MIME types (GIF/SVG/text) and files larger than 5MB', async () => {
    const gifRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .field('cName', 'Bad Mime')
      .field('bName', 'Test Shop')
      .field('channel', 'Retail')
      .field('cnicNo', '35202-1111222-3')
      .field('mobileNo', '0300-5556677')
      .field('address', 'Lahore')
      .field('days', '30')
      .field('creditLimit', '1000')
      .field('chequeStatus', 'No')
      .field('creditType', 'New')
      .attach('shopPicture', Buffer.from('GIF89a'), {
        filename: 'anim.gif',
        contentType: 'image/gif',
      });

    assert.equal(gifRes.status, 400);
    assert.match(gifRes.body.error, /image\/jpeg, image\/png, and image\/webp/);

    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 10, 1);
    const largeRes = await request(app)
      .post('/api/forms')
      .set('Cookie', cookieForRole(1))
      .field('cName', 'Too Large')
      .field('bName', 'Test Shop')
      .field('channel', 'Retail')
      .field('cnicNo', '35202-1111222-3')
      .field('mobileNo', '0300-5556677')
      .field('address', 'Lahore')
      .field('days', '30')
      .field('creditLimit', '1000')
      .field('chequeStatus', 'No')
      .field('creditType', 'New')
      .attach('shopPicture', oversizedBuffer, {
        filename: 'huge.png',
        contentType: 'image/png',
      });

    assert.equal(largeRes.status, 400);
    assert.match(largeRes.body.error, /5MB/);
    assert.equal(s3Commands.length, 0);
  });
});
