import { Request, Response, NextFunction } from 'express';
import { validateTextEstimation, validateImageUpload } from '@/middleware/validation';
import { ValidationError } from '@/models';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {};
    mockNext = jest.fn();
  });

  describe('validateTextEstimation', () => {
    it('should pass valid dish name', () => {
      mockReq.body = { dish: 'Chicken Biryani' };

      validateTextEstimation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body.dish).toBe('Chicken Biryani');
    });

    it('should reject empty dish name', () => {
      mockReq.body = { dish: '' };

      validateTextEstimation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should reject malicious input patterns', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'SELECT * FROM users',
        'javascript:alert(1)',
        '../../../etc/passwd',
        '__proto__.polluted = true',
      ];

      maliciousInputs.forEach(input => {
        mockReq.body = { dish: input };
        mockNext = jest.fn();

        validateTextEstimation(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      });
    });

    it('should reject oversized request body', () => {
      const largeDish = 'A'.repeat(10000);
      mockReq.body = { dish: largeDish };

      validateTextEstimation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should reject excessive repeated characters', () => {
      mockReq.body = { dish: 'A'.repeat(100) };

      validateTextEstimation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should accept international characters', () => {
      const internationalDishes = [
        'Café au lait',
        '中华料理',
        'العشاء العربي',
        'भारतीय खाना',
      ];

      internationalDishes.forEach(dish => {
        mockReq.body = { dish };
        mockNext = jest.fn();

        validateTextEstimation(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith();
      });
    });
  });

  describe('validateImageUpload', () => {
    it('should pass valid image file', () => {
      const validJpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const imageBuffer = Buffer.concat([validJpegHeader, Buffer.alloc(1000)]);
      
      mockReq.file = {
        buffer: imageBuffer,
        mimetype: 'image/jpeg',
        size: imageBuffer.length,
        originalname: 'test.jpg',
      } as Express.Multer.File;

      validateImageUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject missing file', () => {
      mockReq.file = undefined;

      validateImageUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should reject invalid mime types', () => {
      const invalidBuffer = Buffer.alloc(200);
      mockReq.file = {
        buffer: invalidBuffer,
        mimetype: 'application/pdf',
        size: invalidBuffer.length,
        originalname: 'test.pdf',
      } as Express.Multer.File;

      validateImageUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should reject suspicious file extensions', () => {
      const suspiciousFiles = [
        'malware.exe',
        'script.js',
        'hack.php',
        'virus.bat',
      ];

      suspiciousFiles.forEach(filename => {
        const validBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...Buffer.alloc(200)]);
        mockReq.file = {
          buffer: validBuffer,
          mimetype: 'image/jpeg',
          size: validBuffer.length,
          originalname: filename,
        } as Express.Multer.File;
        mockNext = jest.fn();

        validateImageUpload(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      });
    });

    it('should reject files with invalid headers', () => {
      const invalidHeader = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Array(200).fill(0)]);
      mockReq.file = {
        buffer: invalidHeader,
        mimetype: 'image/jpeg',
        size: invalidHeader.length,
        originalname: 'fake.jpg',
      } as Express.Multer.File;

      validateImageUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should reject oversized files', () => {
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024);
      mockReq.file = {
        buffer: largeBuffer,
        mimetype: 'image/jpeg',
        size: largeBuffer.length,
        originalname: 'huge.jpg',
      } as Express.Multer.File;

      validateImageUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
});

