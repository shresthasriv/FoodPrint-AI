import request, { Test } from 'supertest';
import app from '../../server';

describe('API Integration Tests', () => {
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.environment).toBeDefined();
    });
  });

  describe('Edge Cases and Funky Inputs', () => {
    describe('POST /api/v1/estimate', () => {
      it('should handle extremely long dish names', async () => {
        const longDishName = 'A'.repeat(500);
        
        const response = await request(app)
          .post('/api/v1/estimate')
          .send({ dish: longDishName })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should handle special Unicode characters', async () => {
        const unicodeDish = '🍕🍝🥘 International Fusion Délicieux 中华美食';
        
        const response = await request(app)
          .post('/api/v1/estimate')
          .send({ dish: unicodeDish })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should reject SQL injection attempts', async () => {
        const sqlInjection = "'; DROP TABLE users; --";
        
        const response = await request(app)
          .post('/api/v1/estimate')
          .send({ dish: sqlInjection })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('malicious');
      });

      it('should reject XSS attempts', async () => {
        const xssAttempt = '<script>alert("XSS")</script>';
        
        const response = await request(app)
          .post('/api/v1/estimate')
          .send({ dish: xssAttempt })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should handle malformed JSON gracefully', async () => {
        const response = await request(app)
          .post('/api/v1/estimate')
          .set('Content-Type', 'application/json')
          .send('{"dish": invalid json}')
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should handle missing required fields', async () => {
        const response = await request(app)
          .post('/api/v1/estimate')
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should handle excessive request body properties', async () => {
        const bloatedBody: Record<string, string> = { dish: 'test' };
        for (let i = 0; i < 20; i++) {
          bloatedBody[`prop${i}`] = `value${i}`;
        }
        
        const response = await request(app)
          .post('/api/v1/estimate')
          .send(bloatedBody)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should handle null and undefined values', async () => {
        const testCases = [
          { dish: null },
          { dish: undefined },
          null,
          undefined,
        ];

        for (const testCase of testCases) {
          const response = await request(app)
            .post('/api/v1/estimate')
            .send(testCase as any)
            .expect(400);

          expect(response.body.success).toBe(false);
        }
      });
    });

    describe('POST /api/v1/estimate/image', () => {
      it('should reject non-image files', async () => {
        const response = await request(app)
          .post('/api/v1/estimate/image')
          .attach('image', Buffer.from('not an image'), 'test.txt')
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject executable files with image extensions', async () => {
        const response = await request(app)
          .post('/api/v1/estimate/image')
          .attach('image', Buffer.from('MZ executable'), 'malware.jpg.exe')
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should handle corrupted image headers', async () => {
        const corruptedImage = Buffer.alloc(1000, 0);
        
        const response = await request(app)
          .post('/api/v1/estimate/image')
          .attach('image', corruptedImage, 'corrupted.jpg')
          .set('Content-Type', 'multipart/form-data')
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject images that are too small', async () => {
        const tinyFile = Buffer.alloc(10);
        
        const response = await request(app)
          .post('/api/v1/estimate/image')
          .attach('image', tinyFile, 'tiny.jpg')
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should handle missing file upload', async () => {
        const response = await request(app)
          .post('/api/v1/estimate/image')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('No image file provided');
      });
    });

    describe('Rate Limiting', () => {
      it('should enforce rate limits', async () => {
        const promises: Test[] = [];
        for (let i = 0; i < 102; i++) {
          promises.push(
            request(app)
              .post('/api/v1/estimate')
              .send({ dish: `Test dish ${i}` })
          );
        }

        const responses = await Promise.all(promises);
        const rateLimitedResponses = responses.filter(res => res.status === 429);
        
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      });
    });

    describe('404 Handling', () => {
      it('should return 404 for non-existent endpoints', async () => {
        const response = await request(app)
          .get('/api/v1/non-existent')
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });
  });
});

