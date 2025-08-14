import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { config } from '@/config/env';
import { logger } from '@/config/logger';
import {
  requestLogger,
  addRequestId,
  rateLimiter,
  errorHandler,
  notFoundHandler,
} from '@/middleware';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: config.env === 'production' 
    ? ['https://foodprint.reewild.com']
    : true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Request-ID'],
}));

app.use(addRequestId);
app.use(requestLogger);
app.use(rateLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSizeMB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`));
    }
  },
});

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Foodprint AI Backend API',
      version: '1.0.0',
      description: 'Carbon Footprint Estimator for Food Dishes',
    },
    servers: [
      {
        url: config.env === 'production' ? 'https://api.foodprint.reewild.com' : `http://localhost:${config.port}`,
        description: config.env === 'production' ? 'Production server' : 'Development server',
      },
    ],
  },
  apis: ['./src/controllers/*.ts'],
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.env,
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`🚀 Foodprint AI Backend started`, {
    port: config.port,
    environment: config.env,
    docs: `http://localhost:${config.port}/api-docs`,
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});

export default app;
