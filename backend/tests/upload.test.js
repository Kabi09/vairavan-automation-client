import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import {
  startMemoryServer,
  stopMemoryServer,
  createTestUser,
} from './setup.js';
import r2Service from '../src/services/r2Service.js';
import { isR2Configured, getR2BucketName, getR2PublicUrl } from '../src/config/r2.js';

describe('Cloudflare R2 Upload & Storage Tests', () => {
  let employeeUser;
  let employeeToken;

  before(async () => {
    await startMemoryServer();
    const created = await createTestUser({ role: 'employee' });
    employeeUser = created.user;
    employeeToken = created.token;
  });

  after(async () => {
    await stopMemoryServer();
  });

  it('R2 config should provide defaults and detect mock mode when using demo values', () => {
    assert.strictEqual(typeof isR2Configured(), 'boolean');
    assert.strictEqual(typeof getR2BucketName(), 'string');
    assert.strictEqual(typeof getR2PublicUrl(), 'string');
  });

  it('r2Service.generateR2Key should generate unique sanitized keys with prefix and timestamp', () => {
    const key1 = r2Service.generateR2Key('vairavan-automation/signatures', 'test signature.png');
    const key2 = r2Service.generateR2Key('vairavan-automation/signatures', 'test signature.png');

    assert.ok(key1.startsWith('vairavan-automation/signatures/'));
    assert.ok(key1.includes('test_signature.png'));
    assert.notStrictEqual(key1, key2); // Collision resistance
  });

  it('r2Service.uploadBufferToR2 should handle buffer upload and return url, key, and publicId', async () => {
    const sampleBuffer = Buffer.from('mock-image-data-png-stream');
    const result = await r2Service.uploadBufferToR2(sampleBuffer, {
      folder: 'vairavan-automation/signatures',
      originalName: 'signature.png',
      mimeType: 'image/png',
    });

    assert.ok(result.url);
    assert.ok(result.key);
    assert.strictEqual(result.key, result.publicId);
    assert.strictEqual(result.size, sampleBuffer.length);
    assert.strictEqual(result.mimeType, 'image/png');
  });

  it('r2Service.deleteFromR2 should successfully handle deletion', async () => {
    const res = await r2Service.deleteFromR2('vairavan-automation/signatures/mock_test.png');
    assert.ok(res.success);
  });

  it('POST /api/uploads/signature should upload signature and return Cloudflare R2 structure', async () => {
    const res = await request(app)
      .post('/api/uploads/signature')
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('signature', Buffer.from('fake-signature-binary'), 'sig.png');

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.signature.url);
    assert.ok(res.body.data.signature.key);
    assert.strictEqual(res.body.data.signature.publicId, res.body.data.signature.key);
  });

  it('POST /api/uploads/signature with JSON SVG string should upload SVG to Cloudflare R2', async () => {
    const res = await request(app)
      .post('/api/uploads/signature')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        svgString: '<svg width="300" height="150"><path d="M10,10 L100,100"/></svg>',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.signature.url);
    assert.ok(res.body.data.signature.key.endsWith('.svg'));
  });

  it('POST /api/uploads/proof-photos should upload multiple photos and return Cloudflare R2 array', async () => {
    const res = await request(app)
      .post('/api/uploads/proof-photos')
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('photos', Buffer.from('photo-one-data'), 'proof1.jpg')
      .attach('photos', Buffer.from('photo-two-data'), 'proof2.jpg');

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.photos.length, 2);
    assert.ok(res.body.data.photos[0].url);
    assert.ok(res.body.data.photos[0].key);
    assert.ok(res.body.data.photos[1].url);
    assert.ok(res.body.data.photos[1].key);
  });

  it('DELETE /api/uploads/:key(*) should delete asset from Cloudflare R2', async () => {
    const res = await request(app)
      .delete('/api/uploads/vairavan-automation/signatures/test-sig-to-delete.png')
      .set('Authorization', `Bearer ${employeeToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });
});
