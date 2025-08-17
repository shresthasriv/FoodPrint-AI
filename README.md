# FoodPrint AI Backend

A TypeScript/Express.js API that estimates carbon footprints of food dishes using AI services. The application analyzes dish names or food images to identify ingredients and calculate their environmental impact.

## Features

- Text-based dish analysis using OpenAI's language models
- Image-based food recognition using OpenAI's vision models
- Carbon footprint calculations based on ingredient data
- Comprehensive input validation and security measures
- Rate limiting and authentication middleware
- Swagger API documentation
- Docker containerization

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key
- Docker (optional)

## Installation & Setup

### Local Development

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Copy environment configuration:
```bash
cp env.example .env
```

3. Configure your `.env` file with required variables:
```env
NODE_ENV=development
PORT=3000
OPENAI_API_KEY=your_openai_api_key_here
API_KEY=your_api_key_for_authentication
LOG_LEVEL=info
```

4. Run the development server:
```bash
npm run dev
```

5. Run tests:
```bash
npm test
```

### Docker Deployment

1. Build and run with Docker Compose:
```bash
docker-compose up --build
```

The API will be available at `http://localhost:3000`.

## API Documentation

Interactive Swagger documentation is available at `http://localhost:3000/api-docs` when the server is running.

### Authentication

Include the API key in the `x-api-key` header:
```
x-api-key: your_api_key_here
```

## Example Usage

### Text-based Analysis

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/estimate \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key_here" \
  -d '{"dish": "Chicken Biryani"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dish": "Chicken Biryani",
    "estimated_carbon_kg": 4.2,
    "ingredients": [
      {
        "name": "Rice",
        "carbon_kg": 1.1,
        "confidence": 0.85
      },
      {
        "name": "Chicken",
        "carbon_kg": 2.5,
        "confidence": 0.9
      },
      {
        "name": "Spices",
        "carbon_kg": 0.2,
        "confidence": 0.7
      }
    ],
    "metadata": {
      "processing_time_ms": 1250,
      "source": "text"
    }
  },
  "metadata": {
    "timestamp": "2024-01-20T10:30:00.000Z",
    "request_id": "abc-123-def",
    "processing_time_ms": 1250
  }
}
```

### Image-based Analysis

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/estimate/image \
  -H "x-api-key: your_api_key_here" \
  -F "image=@path/to/food-image.jpg"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dish": "Margherita Pizza",
    "estimated_carbon_kg": 3.8,
    "ingredients": [
      {
        "name": "Cheese",
        "carbon_kg": 2.7,
        "confidence": 0.95
      },
      {
        "name": "Tomatoes",
        "carbon_kg": 0.4,
        "confidence": 0.9
      }
    ],
    "metadata": {
      "processing_time_ms": 2100,
      "source": "image"
    }
  }
}
```

### Health Check

**Request:**
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

## Project Structure

```
src/
├── config/           # Configuration management
├── controllers/      # Request handlers
├── middleware/       # Express middleware
├── models/          # Type definitions and interfaces
├── routes/          # Route definitions
├── services/        # Business logic and external API integration
├── utils/           # Utility functions and constants
└── __tests__/       # Test suites
```

## Key Design Decisions

### Architecture Choices
- **Layered Architecture**: Clear separation between controllers, services, and middleware for maintainability and testability
- **TypeScript**: Provides type safety and better developer experience, reducing runtime errors
- **Service-Oriented Design**: Business logic isolated in service layers, making the codebase modular and testable

### Security Implementation
- **Input Validation**: Comprehensive validation using custom middleware to prevent injection attacks and malformed data
- **Rate Limiting**: Protection against abuse and ensuring fair usage of external API resources
- **File Upload Security**: MIME type validation and file header verification for image uploads
- **Error Handling**: Structured error responses that don't leak sensitive information

### AI Integration Strategy
- **Dual Analysis Methods**: Support for both text and image inputs to maximize user accessibility
- **Confidence Scoring**: AI responses include confidence metrics to help users evaluate result reliability
- **Timeout Handling**: Prevents hanging requests due to external API issues
- **Response Validation**: Ensures AI responses conform to expected schemas before processing

### Performance Considerations
- **Async/Await Pattern**: Non-blocking operations for better concurrency
- **Request Timeouts**: Prevents resource exhaustion from slow external API calls
- **Lightweight Dependencies**: Minimal dependency footprint for faster startup and reduced attack surface

## Production Considerations

### Scalability Enhancements
- **Redis Integration**: Implement distributed rate limiting and caching layer for repeated requests
- **Message Queue System**: Add Redis or RabbitMQ for asynchronous AI processing to handle high loads
- **Database Layer**: Implement persistent storage for user data, request history, and carbon footprint analytics
- **Circuit Breakers**: Add resilience patterns for external API calls to handle service failures gracefully

### Monitoring and Observability
- **Metrics Collection**: Integrate Prometheus for application metrics and performance monitoring
- **Structured Logging**: Enhanced logging with correlation IDs for distributed tracing
- **Health Checks**: Comprehensive health endpoints for dependency status monitoring
- **Alert System**: Configure alerts for API failures, high error rates, and performance degradation

### Security and Compliance
- **API Key Management**: Implement proper key rotation and scope-based access control
- **Data Privacy**: Add data retention policies and user consent management for GDPR compliance
- **Audit Logging**: Track all API usage for security and compliance reporting
- **HTTPS Enforcement**: Ensure all communications are encrypted in transit

### Infrastructure and Deployment
- **Container Orchestration**: Deploy using Kubernetes for automatic scaling and failover
- **Load Balancing**: Implement proper load distribution across multiple application instances
- **Environment Management**: Separate configurations for development, staging, and production environments
- **Backup and Recovery**: Implement data backup strategies and disaster recovery procedures

### Cost Optimization
- **Request Caching**: Cache AI responses for identical requests to reduce external API costs
- **Batch Processing**: Implement request batching for bulk operations to optimize API usage
- **Resource Monitoring**: Track OpenAI API usage and implement cost controls and budgets
- **Auto-scaling**: Configure automatic scaling based on demand to optimize infrastructure costs

