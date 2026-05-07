import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';
import pinataSDK from '@pinata/sdk';
import { ethers } from 'ethers';

// Import our new modules
import { logger } from './src/logger.js';
import { config, validateEnvironment } from './src/config.js';
import { ApiError, DuplicateFileError, BlockchainError, IpfsError } from './src/errors.js';
import {
  detectFileCategory,
  isAllowedFile,
  validateFileSize,
  validateHash,
  sanitizeFilename,
} from './src/validators.js';
import {
  errorHandler,
  requestLogger,
  securityHeaders,
  createRateLimiter,
} from './src/middleware.js';

// Import existing utilities
import { applyVisibleWatermark, calculateSHA256, calculatePHash } from './src/hashUtils.js';
import { AI_AUTHENTICITY_MODEL_NAME, analyzeContentAuthenticity } from './src/aiAuthenticity.js';
import abi from './src/GenesisRegistry.json' with { type: 'json' };

// Validate environment on startup
const envValidation = validateEnvironment();
if (!envValidation.isValid) {
  logger.error('Environment validation failed', {
    missing: envValidation.missing,
    warnings: envValidation.warnings,
  });
  throw new Error(`Missing required environment variables: ${envValidation.missing.join(', ')}`);
}

if (envValidation.warnings.length > 0) {
  envValidation.warnings.forEach((warning) => logger.warn(warning));
}

// Initialize Pinata
let pinata;
if (config.pinataJwtToken) {
  pinata = new pinataSDK({ pinataJWTKey: config.pinataJwtToken });
} else if (config.pinataApiKey && config.pinataApiSecret) {
  pinata = new pinataSDK(config.pinataApiKey, config.pinataApiSecret);
} else {
  logger.warn('Pinata credentials missing - IPFS uploads will fail');
}

// Initialize Ethereum provider and contract
const provider = new ethers.JsonRpcProvider(config.rpcUrl);
const isLocalRpc = /127\.0\.0\.1|localhost/.test(config.rpcUrl);

let signer;
if (config.privateKey) {
  signer = new ethers.Wallet(config.privateKey, provider);
} else if (isLocalRpc) {
  signer = await provider.getSigner(0);
} else {
  throw new Error('Missing PRIVATE_KEY for non-local RPC_URL');
}

const genesisContract = new ethers.Contract(config.contractAddress, abi.abi, signer);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

logger.info('Connected to blockchain', {
  rpcUrl: config.rpcUrl,
  contractAddress: config.contractAddress,
});

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(process.cwd(), config.uploadDir);
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  logger.info('Created uploads directory', { path: UPLOAD_DIR });
}

// Initialize Express app
const app = express();

// Security and logging middleware
app.use(securityHeaders);
app.use(requestLogger);

// Rate limiting
const rateLimiter = createRateLimiter(60000, 100); // 100 requests per minute
app.use('/api/', rateLimiter);

// CORS configuration
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeOrigin = (value) => value.replace(/\/$/, '');

const parseAllowedOrigins = (originCsv) => {
  const entries = originCsv
    .split(',')
    .map((entry) => normalizeOrigin(entry.trim()))
    .filter(Boolean);
  const exact = new Set();
  const patterns = [];

  for (const entry of entries) {
    if (entry.includes('*')) {
      const regex = new RegExp(`^${escapeRegex(entry).replace(/\\\*/g, '.*')}$`);
      patterns.push(regex);
    } else {
      exact.add(entry);
    }
  }

  return { exact, patterns };
};

const configuredCors = config.corsOrigin ? parseAllowedOrigins(config.corsOrigin) : null;

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (!configuredCors) return true;

  const normalized = normalizeOrigin(origin);
  if (configuredCors.exact.has(normalized)) return true;
  return configuredCors.patterns.some((pattern) => pattern.test(normalized));
};

app.use(
  cors({
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) {
        return cb(null, true);
      }
      return cb(new ApiError(403, `CORS blocked for origin: ${origin}`));
    },
    optionsSuccessStatus: 200,
  })
);

app.use(express.json({ limit: '10mb' }));

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (req, file, cb) => {
    try {
      if (!isAllowedFile(file)) {
        return cb(
          new ApiError(
            400,
            'Unsupported file type. Allowed: images, MP4/video, MP3/audio, PDF, CSV, TXT, DOC/DOCX, XLS/XLSX, PPT/PPTX.'
          )
        );
      }
      cb(null, true);
    } catch (error) {
      cb(error);
    }
  },
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const runtime = {
      rpcReachable: false,
      contractCodePresent: false,
      contractReadOk: false,
      chainId: null,
      blockNumber: null,
    };

    const network = await provider.getNetwork();
    runtime.chainId = network?.chainId?.toString() || null;
    runtime.blockNumber = await provider.getBlockNumber();
    runtime.rpcReachable = true;

    const contractCode = await provider.getCode(config.contractAddress);
    runtime.contractCodePresent = Boolean(contractCode && contractCode !== '0x');

    if (runtime.contractCodePresent) {
      try {
        await genesisContract.getRecord('__health_probe__');
        runtime.contractReadOk = true;
      } catch (readError) {
        runtime.contractReadOk = false;
        runtime.contractReadError = readError.message;
      }
    } else {
      runtime.contractReadError =
        'No contract bytecode at CONTRACT_ADDRESS for the configured RPC network.';
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.1',
      environment: config.nodeEnv,
      runtime,
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded');
    }

    const file = req.file;
    const originalFilename = sanitizeFilename(file.originalname);
    const fileCategory = detectFileCategory(file);
    const isImage = fileCategory === 'image';

    logger.info('Processing file upload', {
      filename: originalFilename,
      size: file.size,
      category: fileCategory,
    });

    // Validate file
    validateFileSize(file);

    // Calculate SHA-256 hash
    const sha256Hash = await calculateSHA256(file.path);
    logger.info('SHA-256 calculated', { hash: sha256Hash });

    // Check for existing record
    const existingRecord = await genesisContract.getRecord(sha256Hash);
    if (existingRecord.creator !== ZERO_ADDRESS) {
      const existingFilename = await getPinnedFilenameByCid(existingRecord.ipfsCid);
      const sameFilename =
        existingFilename &&
        existingFilename.trim().toLowerCase() === originalFilename.trim().toLowerCase();

      if (sameFilename) {
        logger.info('Duplicate file detected', { hash: sha256Hash });
        return res.json({
          message:
            'File already registered (same SHA-256 and filename). Returning existing record.',
          alreadyRegistered: true,
          filename: originalFilename,
          isImage,
          fileCategory,
          mimetype: file.mimetype || 'application/octet-stream',
          sha256: existingRecord.sha256Hash,
          pHash: existingRecord.pHash,
          aiAnalysis: await analyzeContentAuthenticity(file.path, originalFilename),
          ipfsCid: existingRecord.ipfsCid,
          record: {
            creator: existingRecord.creator,
            timestamp: existingRecord.timestamp.toString(),
          },
        });
      }

      throw new DuplicateFileError(
        'SHA-256 already registered with a different filename. Duplicate content cannot be re-registered.',
        {
          existingFilename,
          incomingFilename: originalFilename,
          record: {
            sha256: existingRecord.sha256Hash,
            pHash: existingRecord.pHash,
            ipfsCid: existingRecord.ipfsCid,
            creator: existingRecord.creator,
            timestamp: existingRecord.timestamp.toString(),
          },
        }
      );
    }

    // AI analysis
    const aiAnalysis = await analyzeContentAuthenticity(file.path, originalFilename);
    logger.info('AI analysis complete', {
      verdict: aiAnalysis.verdict,
      confidence: aiAnalysis.aiConfidence,
    });

    let pHash = 'not_applicable';
    let watermarkApplied = false;
    let watermarkWarning = null;
    let pHashWarning = null;

    // Apply watermark for images
    if (isImage) {
      try {
        const watermarkText = `AI-based-content-Authenticity-and-Verification-Platform - ${new Date().toISOString()}`;
        await applyVisibleWatermark(file.path, watermarkText);
        watermarkApplied = true;
        logger.info('Watermark applied successfully');
      } catch (watermarkError) {
        if (config.watermarkStrict) {
          throw new ApiError(
            500,
            'Watermark processing failed',
            'Set WATERMARK_STRICT=false to skip watermarking'
          );
        }
        watermarkWarning = 'Watermark skipped due to processing issue.';
        logger.warn('Watermark skipped', { error: watermarkError.message });
      }

      // Calculate perceptual hash
      try {
        pHash = await calculatePHash(file.path);
        logger.info('Perceptual hash calculated', { pHash });
      } catch (pHashError) {
        if (config.watermarkStrict) {
          throw new ApiError(500, 'Perceptual hash calculation failed');
        }
        pHash = 'not_available';
        pHashWarning = 'Perceptual hash skipped due to processing issue.';
        logger.warn('Perceptual hash skipped', { error: pHashError.message });
      }
    }

    // Upload to IPFS
    if (!pinata) {
      throw new IpfsError(
        'IPFS service unavailable',
        'Configure PINATA_JWT_TOKEN or PINATA_API_KEY/PINATA_API_SECRET'
      );
    }

    logger.info('Uploading to IPFS');
    const stream = fs.createReadStream(file.path);
    const options = {
      pinataMetadata: {
        name: originalFilename,
        keyvalues: { sha256: sha256Hash, pHash },
      },
    };

    const ipfsResult = await pinata.pinFileToIPFS(stream, options);
    const ipfsCid = ipfsResult.IpfsHash;
    logger.info('IPFS upload complete', { cid: ipfsCid });

    // Register on blockchain
    logger.info('Registering on blockchain');
    const tx = await genesisContract.registerContent(sha256Hash, pHash, ipfsCid);
    const receipt = await tx.wait();
    logger.info('Blockchain registration complete', {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });

    res.json({
      message: 'File registered successfully',
      filename: originalFilename,
      isImage,
      fileCategory,
      mimetype: file.mimetype || 'application/octet-stream',
      sha256: sha256Hash,
      pHash,
      aiAnalysis,
      ipfsCid,
      transaction: {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      },
      record: {
        creator: await signer.getAddress(),
        timestamp: Math.floor(Date.now() / 1000),
      },
      warnings: {
        watermark: watermarkWarning,
        pHash: pHashWarning,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    // Clean up uploaded file
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) logger.warn('Failed to clean up temp file', { error: err.message });
      });
    }
  }
});

// Verify endpoint
app.post('/api/verify', async (req, res, next) => {
  try {
    const { hash } = req.body;

    if (!hash) {
      throw new ApiError(400, 'Hash parameter is required');
    }

    validateHash(hash);

    logger.info('Verifying content', { hash });

    const record = await genesisContract.getRecord(hash);

    if (record.creator === ZERO_ADDRESS) {
      return res.status(404).json({
        verified: false,
        message: 'Content not found in registry',
        hash,
      });
    }

    const filename = await getPinnedFilenameByCid(record.ipfsCid);

    res.json({
      verified: true,
      message: 'Content verified successfully',
      hash,
      record: {
        creator: record.creator,
        timestamp: record.timestamp.toString(),
        sha256Hash: record.sha256Hash,
        pHash: record.pHash,
        ipfsCid: record.ipfsCid,
        filename,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to get filename by CID
const getPinnedFilenameByCid = async (cid) => {
  if (!pinata || !cid) return null;

  try {
    const result = await pinata.pinList({ hashContains: cid, status: 'pinned', pageLimit: 10 });
    const exactMatch = result.rows?.find((row) => row.ipfs_pin_hash === cid);
    return exactMatch?.metadata?.name || null;
  } catch (error) {
    logger.warn('Failed to get filename by CID', { cid, error: error.message });
    return null;
  }
};

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  logger.info('Server started', {
    port: config.port,
    environment: config.nodeEnv,
    corsOrigin: config.corsOrigin,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
