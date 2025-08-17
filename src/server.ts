import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import estimateRoutes from '@/routes/estimate';

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



const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Foodprint AI Backend API',
      version: '1.0.0',
      description: `
# Carbon Footprint Estimator for Food Dishes

This API helps estimate the carbon footprint of food dishes using AI-powered ingredient analysis.

## Features
- 🤖 **LLM-powered ingredient extraction** from dish names
- 👁️ **Computer vision analysis** of food images  
- 🌱 **Carbon footprint calculation** based on ingredient database
- 🔒 **API key authentication** for secure access
- ⚡ **Rate limiting** to ensure fair usage
- 📊 **Comprehensive logging** and error handling

## Getting Started
1. Obtain an API key from your administrator
2. Include the API key in requests via \`X-API-Key\` header
3. Start making requests to estimate carbon footprints!

## Rate Limits
- **100 requests per 15 minutes** per API key
- Rate limits are enforced per authenticated user
- Unauthenticated requests share a common rate limit per IP

## Response Format
All endpoints return a standardized response format with success/error indicators,
data payload, and metadata including processing time and request tracking.
      `,
      contact: {
        name: 'Reewild API Support',
        url: 'https://reewild.com',
        email: 'api-support@reewild.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: config.env === 'production' ? 'https://api.foodprint.reewild.com' : `http://localhost:${config.port}`,
        description: config.env === 'production' ? 'Production server' : 'Development server',
      },
    ],
    tags: [
      {
        name: 'Carbon Estimation',
        description: 'Endpoints for estimating carbon footprints of food dishes',
      },
      {
        name: 'Health',
        description: 'API health and status endpoints',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: `
API key for authentication. Obtain from your administrator.

**Example valid API keys for testing:**
- \`demo-key-1\`
- \`test-key-2\` 
- \`foodprint-api-key\`

Include in requests like: \`X-API-Key: demo-key-1\`
          `,
        },
      },
      schemas: {
        Ingredient: {
          type: 'object',
          required: ['name', 'carbon_kg'],
          properties: {
            name: {
              type: 'string',
              description: 'Name of the ingredient',
              example: 'Chicken',
            },
            carbon_kg: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Carbon footprint in kg CO2 equivalent per kg of ingredient',
              example: 2.5,
            },
            confidence: {
              type: 'number',
              format: 'float',
              minimum: 0,
              maximum: 1,
              description: 'Confidence score for ingredient identification (0-1)',
              example: 0.9,
            },
          },
        },
        CarbonEstimate: {
          type: 'object',
          required: ['dish', 'estimated_carbon_kg', 'ingredients'],
          properties: {
            dish: {
              type: 'string',
              description: 'Name of the analyzed dish',
              example: 'Chicken Biryani',
            },
            estimated_carbon_kg: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Total estimated carbon footprint in kg CO2 equivalent',
              example: 4.2,
            },
            ingredients: {
              type: 'array',
              description: 'List of identified ingredients with individual carbon footprints',
              items: {
                $ref: '#/components/schemas/Ingredient',
              },
            },
            metadata: {
              type: 'object',
              description: 'Additional processing metadata',
              properties: {
                processing_time_ms: {
                  type: 'number',
                  description: 'Total processing time in milliseconds',
                  example: 1250,
                },
                source: {
                  type: 'string',
                  enum: ['text', 'image'],
                  description: 'Source of the analysis (text or image)',
                  example: 'text',
                },
              },
            },
          },
        },
        CarbonEstimateResponse: {
          type: 'object',
          required: ['success', 'metadata'],
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful',
              example: true,
            },
            data: {
              $ref: '#/components/schemas/CarbonEstimate',
            },
            metadata: {
              type: 'object',
              required: ['timestamp', 'request_id'],
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  description: 'ISO 8601 timestamp of the response',
                  example: '2024-01-20T10:30:00.000Z',
                },
                request_id: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Unique identifier for request tracking',
                  example: 'abc-123-def-456',
                },
                processing_time_ms: {
                  type: 'number',
                  description: 'Total request processing time in milliseconds',
                  example: 1250,
                },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['success', 'error', 'metadata'],
          properties: {
            success: {
              type: 'boolean',
              description: 'Always false for error responses',
              example: false,
            },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code for programmatic handling',
                  enum: [
                    'VALIDATION_ERROR',
                    'AUTHENTICATION_ERROR', 
                    'RATE_LIMIT_ERROR',
                    'AI_SERVICE_ERROR',
                    'INTERNAL_ERROR',
                    'FILE_UPLOAD_ERROR',
                  ],
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  description: 'Human-readable error description',
                  example: 'Invalid request data',
                },
                details: {
                  type: 'object',
                  description: 'Additional error details and context',
                  example: {
                    field: 'dish',
                    message: 'Dish name cannot be empty',
                  },
                },
              },
            },
            metadata: {
              type: 'object',
              required: ['timestamp', 'request_id'],
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-01-20T10:30:00.000Z',
                },
                request_id: {
                  type: 'string',
                  format: 'uuid',
                  example: 'abc-123-def-456',
                },
              },
            },
          },
        },
        HealthResponse: {
          type: 'object',
          required: ['status', 'timestamp', 'version', 'environment'],
          properties: {
            status: {
              type: 'string',
              enum: ['ok', 'error'],
              description: 'Health status of the API',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Current server timestamp',
              example: '2024-01-20T10:30:00.000Z',
            },
            version: {
              type: 'string',
              description: 'API version',
              example: '1.0.0',
            },
            environment: {
              type: 'string',
              description: 'Deployment environment',
              example: 'production',
            },
          },
        },
      },
      responses: {
        ValidationError: {
          description: 'Validation error - invalid input data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              examples: {
                empty_dish: {
                  summary: 'Empty dish name',
                  value: {
                    success: false,
                    error: {
                      code: 'VALIDATION_ERROR',
                      message: 'Invalid request data',
                      details: {
                        field: 'dish',
                        message: 'Dish name cannot be empty',
                      },
                    },
                    metadata: {
                      timestamp: '2024-01-20T10:30:00.000Z',
                      request_id: 'abc-123-def-456',
                    },
                  },
                },
                malicious_input: {
                  summary: 'Malicious input detected',
                  value: {
                    success: false,
                    error: {
                      code: 'VALIDATION_ERROR',
                      message: 'Dish name contains potentially malicious content',
                    },
                    metadata: {
                      timestamp: '2024-01-20T10:30:00.000Z',
                      request_id: 'abc-123-def-456',
                    },
                  },
                },
              },
            },
          },
        },
        AuthenticationError: {
          description: 'Authentication required or invalid API key',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'AUTHENTICATION_ERROR',
                  message: 'Invalid API key',
                },
                metadata: {
                  timestamp: '2024-01-20T10:30:00.000Z',
                  request_id: 'abc-123-def-456',
                },
              },
            },
          },
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'RATE_LIMIT_ERROR',
                  message: 'Too many requests, please try again later',
                },
                metadata: {
                  timestamp: '2024-01-20T10:30:00.000Z',
                  request_id: 'abc-123-def-456',
                },
              },
            },
          },
        },
        AIServiceError: {
          description: 'AI service unavailable or processing error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'AI_SERVICE_ERROR',
                  message: 'AI service request timed out, please try again',
                },
                metadata: {
                  timestamp: '2024-01-20T10:30:00.000Z',
                  request_id: 'abc-123-def-456',
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: ['./src/controllers/*.ts', './src/server.ts'],
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current health status of the API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy and operational
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: "ok"
 *               timestamp: "2024-01-20T10:30:00.000Z"
 *               version: "1.0.0"
 *               environment: "production"
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.env,
  });
});

// API routes
app.use('/api/v1', estimateRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`Foodprint Backend started`, {
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
