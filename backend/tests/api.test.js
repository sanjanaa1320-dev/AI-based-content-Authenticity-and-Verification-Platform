import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../index.js';

// Mock external dependencies
jest.mock('@pinata/sdk');
jest.mock('ethers');

describe('API Endpoints', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('runtime');
    });
  });

  describe('POST /api/upload', () => {
    it('should reject requests without files', async () => {
      const response = await request(app).post('/api/upload').expect(400);

      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });

    it('should reject unsupported file types', async () => {
      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test'), 'test.exe')
        .expect(400);

      expect(response.body.error).toContain('Unsupported file type');
    });
  });

  describe('POST /api/verify', () => {
    it('should reject requests without hash', async () => {
      const response = await request(app).post('/api/verify').send({}).expect(400);

      expect(response.body).toHaveProperty('error', 'Hash parameter is required');
    });

    it('should reject invalid hash format', async () => {
      const response = await request(app)
        .post('/api/verify')
        .send({ hash: 'invalid-hash' })
        .expect(400);

      expect(response.body.error).toContain('Invalid hash format');
    });
  });
});

describe('Error Handling', () => {
  it('should handle 404 errors', async () => {
    const response = await request(app).get('/nonexistent').expect(404);

    expect(response.body).toHaveProperty('error', 'Not Found');
  });

  it('should handle malformed JSON', async () => {
    const response = await request(app)
      .post('/api/verify')
      .set('Content-Type', 'application/json')
      .send('{invalid json}')
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });
});
