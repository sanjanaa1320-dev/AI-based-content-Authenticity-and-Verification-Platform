/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(statusCode, message, hint = null) {
    super(message);
    this.statusCode = statusCode;
    this.hint = hint;
    this.isDuplicate = false;
    this.name = "ApiError";
  }
}

/**
 * Validation error for input validation
 */
export class ValidationError extends ApiError {
  constructor(message, hint = null) {
    super(400, message, hint);
    this.name = "ValidationError";
  }
}

/**
 * Error for duplicate file registration
 */
export class DuplicateFileError extends ApiError {
  constructor(message, details = {}) {
    super(409, message, "Try Verify for this file instead of Register.");
    this.isDuplicate = true;
    this.details = details;
    this.name = "DuplicateFileError";
  }
}

/**
 * Error for blockchain-related issues
 */
export class BlockchainError extends ApiError {
  constructor(message, hint = null) {
    super(
      500,
      message,
      hint || "Check blockchain configuration and network status.",
    );
    this.name = "BlockchainError";
  }
}

/**
 * Error for IPFS/Pinata-related issues
 */
export class IpfsError extends ApiError {
  constructor(message, hint = null) {
    super(500, message, hint || "Check IPFS/Pinata configuration.");
    this.name = "IpfsError";
  }
}

/**
 * Error for external service failures
 */
export class ServiceUnavailableError extends ApiError {
  constructor(serviceName, hint = null) {
    super(503, `${serviceName} service is unavailable.`, hint);
    this.serviceName = serviceName;
    this.name = "ServiceUnavailableError";
  }
}
