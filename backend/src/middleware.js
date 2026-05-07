import { logger } from "./logger.js";
import { ApiError } from "./errors.js";

/**
 * Global error handling middleware
 * Should be added as the last middleware in Express
 */
export const errorHandler = (err, req, res, next) => {
  const requestId = req.id || "unknown";

  // Handle known API errors
  if (err instanceof ApiError) {
    logger.warn(`API Error: ${err.name}`, {
      requestId,
      statusCode: err.statusCode,
      message: err.message,
      hint: err.hint,
    });

    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.hint && { hint: err.hint }),
      ...(err.isDuplicate && { isDuplicate: true }),
      ...(err.details && { details: err.details }),
      requestId,
    });
  }

  // Handle Multer errors
  if (err.name === "MulterError") {
    logger.warn("Multer Error", { requestId, message: err.message });

    let statusCode = 400;
    let message = err.message;

    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large. Maximum 100MB allowed.";
    } else if (err.code === "LIMIT_FILE_COUNT") {
      message = "Too many files. Only one file per request.";
    }

    return res.status(statusCode).json({ error: message, requestId });
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    logger.warn("Validation Error", { requestId, message: err.message });
    return res.status(400).json({ error: err.message, requestId });
  }

  // Handle unexpected errors
  logger.error("Unexpected Error", {
    requestId,
    message: err.message,
    stack: err.stack,
    name: err.name,
  });

  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : "Internal server error";

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { debug: err.message }),
    requestId,
  });
};

/**
 * Request logging middleware
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  req.id = requestId;

  // Log request
  logger.info(`${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? "warn" : "info";

    logger[level](`${req.method} ${req.path} ${res.statusCode}`, {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req, res, next) => {
  // Prevent MIME type sniffing
  res.set("X-Content-Type-Options", "nosniff");

  // Enable XSS protection
  res.set("X-XSS-Protection", "1; mode=block");

  // Clickjacking protection
  res.set("X-Frame-Options", "DENY");

  // Referrer policy
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // CSP header
  res.set("Content-Security-Policy", "default-src 'self'");

  // HSTS (only in production)
  if (process.env.NODE_ENV === "production") {
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
};

/**
 * Simple rate limiting using in-memory store
 * For production, use Redis-based solution
 */
const rateLimitStore = new Map();

export const createRateLimiter = (windowMs = 60000, maxRequests = 100) => {
  // Cleanup old entries every minute
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000);

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || record.resetTime < now) {
      record = { count: 0, resetTime: now + windowMs };
      rateLimitStore.set(key, record);
    }

    record.count++;

    res.set("RateLimit-Limit", maxRequests);
    res.set("RateLimit-Remaining", Math.max(0, maxRequests - record.count));
    res.set("RateLimit-Reset", new Date(record.resetTime).toISOString());

    if (record.count > maxRequests) {
      logger.warn("Rate limit exceeded", {
        ip: key,
        requests: record.count,
        limit: maxRequests,
      });

      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
};

/**
 * Request validation middleware factory
 */
export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      // Validate body if provided
      if (schema.body) {
        // Add validation logic here if using a validation library like Joi or Zod
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
