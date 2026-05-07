# AI Content Authenticity & Verification Platform - Backend

A production-ready Node.js backend service for AI-powered content authenticity verification with blockchain integration.

## Features

- **AI-Powered Analysis**: Advanced content authenticity verification for images, audio, and video files
- **Blockchain Integration**: Immutable content registration using Ethereum smart contracts
- **IPFS Storage**: Decentralized file storage with Pinata SDK
- **Security First**: Rate limiting, CORS, input validation, and security headers
- **Production Ready**: Comprehensive logging, error handling, and monitoring
- **Containerized**: Docker support for easy deployment

## Tech Stack

- **Runtime**: Node.js 18+ with ES modules
- **Framework**: Express.js with security middleware
- **Blockchain**: Ethereum with Ethers.js v6
- **Storage**: IPFS via Pinata SDK
- **Image Processing**: Jimp for watermarking
- **Validation**: Custom input sanitization and validation
- **Logging**: Structured logging with Winston-style implementation
- **Testing**: Jest for unit and integration tests

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker (optional, for containerized deployment)

### Installation

1. **Clone and navigate to backend directory:**

   ```bash
   cd backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Environment Setup:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Hardhat local blockchain:**

   ```bash
   cd blockchain
   npm install
   npx hardhat node
   ```

5. **Deploy smart contract:**

   ```bash
   npx hardhat run scripts/deploy.ts --network localhost
   # Copy the deployed contract address to your .env file
   ```

6. **Start the backend server:**
   ```bash
   cd ..
   npm start
   ```

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Start all services (backend, blockchain, frontend)
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

### Using Docker only

```bash
# Build the image
docker build -t ai-auth-backend .

# Run the container
docker run -p 3001:3001 \
  -e RPC_URL=http://host.docker.internal:8545 \
  -e CONTRACT_ADDRESS=your_contract_address \
  -e PRIVATE_KEY=your_private_key \
  -e PINATA_JWT_TOKEN=your_pinata_token \
  ai-auth-backend
```

## API Endpoints

### Health Check

```http
GET /health
```

Returns server health status including blockchain connectivity.

### Upload Content

```http
POST /api/upload
Content-Type: multipart/form-data

Form Data:
- file: File to upload (image, audio, video, document)
```

### Verify Content

```http
POST /api/verify
Content-Type: application/json

{
  "hash": "sha256_hash_of_content"
}
```

## Environment Variables

| Variable            | Description               | Required | Default                 |
| ------------------- | ------------------------- | -------- | ----------------------- |
| `NODE_ENV`          | Environment mode          | No       | `development`           |
| `PORT`              | Server port               | No       | `3001`                  |
| `CORS_ORIGIN`       | Allowed origins for CORS  | No       | `http://localhost:5173` |
| `RPC_URL`           | Ethereum RPC endpoint     | Yes      | -                       |
| `CONTRACT_ADDRESS`  | Deployed contract address | Yes      | -                       |
| `PRIVATE_KEY`       | Ethereum private key      | Yes      | -                       |
| `PINATA_JWT_TOKEN`  | Pinata JWT token          | Yes\*    | -                       |
| `PINATA_API_KEY`    | Pinata API key            | Yes\*    | -                       |
| `PINATA_API_SECRET` | Pinata API secret         | Yes\*    | -                       |
| `WATERMARK_STRICT`  | Fail on watermark errors  | No       | `false`                 |
| `MAX_FILE_SIZE`     | Maximum file size (bytes) | No       | `104857600`             |
| `UPLOAD_DIR`        | Upload directory path     | No       | `uploads`               |
| `LOG_LEVEL`         | Logging level             | No       | `info`                  |
| `LOG_TO_FILE`       | Enable file logging       | No       | `true`                  |
| `LOG_FILE_PATH`     | Log file path             | No       | `logs/app.log`          |

\*Either `PINATA_JWT_TOKEN` or both `PINATA_API_KEY` and `PINATA_API_SECRET` required.

## Development

### Code Quality

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Format code
npm run format
```

### Project Structure

```
backend/
├── src/
│   ├── aiAuthenticity.js    # AI analysis engine
│   ├── config.js           # Configuration management
│   ├── errors.js           # Custom error classes
│   ├── hashUtils.js        # Hash calculation utilities
│   ├── logger.js           # Logging system
│   ├── middleware.js       # Express middleware
│   ├── validators.js       # Input validation
│   └── watermark.py        # Python watermarking
├── blockchain/             # Smart contracts
├── uploads/               # File uploads directory
├── logs/                  # Application logs
├── index.js               # Main server file
├── package.json
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Security Features

- **Rate Limiting**: 100 requests per minute per IP
- **CORS Protection**: Configurable origin validation
- **Input Validation**: File type, size, and content validation
- **Security Headers**: Helmet.js security headers
- **Error Handling**: Comprehensive error responses without sensitive data
- **File Upload Security**: Multer with strict file filtering

## Monitoring

### Health Checks

The `/health` endpoint provides:

- Server status and uptime
- Blockchain connectivity
- Contract deployment status
- Network information

### Logging

Structured logging includes:

- Request/response logging
- Error tracking with stack traces
- Performance metrics
- Security events

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production RPC URL
- [ ] Set up proper CORS origins
- [ ] Enable file logging
- [ ] Configure monitoring/alerts
- [ ] Set up SSL/TLS
- [ ] Configure reverse proxy (nginx)
- [ ] Set up process manager (PM2)

### Example PM2 Configuration

```json
{
  "name": "ai-auth-backend",
  "script": "index.js",
  "instances": "max",
  "exec_mode": "cluster",
  "env": {
    "NODE_ENV": "production",
    "PORT": 3001
  }
}
```

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass
5. Create feature branches for changes

## License

This project is licensed under the MIT License.
