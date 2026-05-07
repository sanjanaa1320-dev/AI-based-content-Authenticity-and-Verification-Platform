import { ValidationError } from "./errors.js";
import { config } from "./config.js";

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".bmp",
  ".gif",
  ".tif",
  ".tiff",
]);
const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".aac",
  ".flac",
  ".ogg",
  ".m4a",
  ".wma",
  ".opus",
]);
const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".webm",
  ".avi",
  ".mov",
  ".flv",
  ".wmv",
  ".m4v",
  ".3gp",
  ".ts",
]);
const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".csv",
  ".txt",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
]);

/**
 * Detects file category by MIME type and extension
 */
export const detectFileCategory = (file) => {
  if (!file) throw new ValidationError("File is required");

  const mimetype = (file.mimetype || "").toLowerCase();
  const ext = file.originalname
    ? `.${file.originalname.split(".").pop().toLowerCase()}`
    : "";

  if (mimetype.startsWith("image/") || IMAGE_EXTENSIONS.has(ext))
    return "image";
  if (mimetype.startsWith("video/") || VIDEO_EXTENSIONS.has(ext))
    return "video";
  if (mimetype.startsWith("audio/") || AUDIO_EXTENSIONS.has(ext))
    return "audio";
  if (DOCUMENT_EXTENSIONS.has(ext)) return "file";
  return "file";
};

/**
 * Validates if file type is allowed
 */
export const isAllowedFile = (file) => {
  if (!file || !file.originalname) return false;

  const mimetype = (file.mimetype || "").toLowerCase();
  const ext = `.${file.originalname.split(".").pop().toLowerCase()}`;

  if (mimetype.startsWith("image/") || IMAGE_EXTENSIONS.has(ext)) return true;
  if (mimetype.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) return true;
  if (mimetype.startsWith("audio/") || AUDIO_EXTENSIONS.has(ext)) return true;
  if (DOCUMENT_EXTENSIONS.has(ext)) return true;
  return false;
};

/**
 * Validates file size
 */
export const validateFileSize = (file) => {
  if (!file) throw new ValidationError("File is required");
  if (file.size > config.maxFileSize) {
    throw new ValidationError(
      `File too large. Maximum allowed size is ${config.maxFileSize / (1024 * 1024)}MB.`,
    );
  }
  if (file.size === 0) {
    throw new ValidationError("File is empty");
  }
};

/**
 * Validates file extension
 */
export const validateFileExtension = (filename) => {
  if (!filename) throw new ValidationError("Filename is required");

  const parts = filename.split(".");
  if (parts.length < 2) {
    throw new ValidationError("File must have an extension");
  }

  const ext = `.${parts[parts.length - 1].toLowerCase()}`;
  const allExtensions = new Set([
    ...IMAGE_EXTENSIONS,
    ...AUDIO_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
    ...DOCUMENT_EXTENSIONS,
  ]);

  if (!allExtensions.has(ext)) {
    throw new ValidationError(
      "Unsupported file type. Allowed: images, MP4/video, MP3/audio, PDF, CSV, TXT, DOC/DOCX, XLS/XLSX, PPT/PPTX.",
    );
  }
};

/**
 * Validates hash format (SHA-256)
 */
export const validateHash = (hash) => {
  if (!hash) throw new ValidationError("Hash is required");
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new ValidationError(
      "Invalid hash format. Expected 64-character hexadecimal string.",
    );
  }
};

/**
 * Sanitizes filename to prevent directory traversal
 */
export const sanitizeFilename = (filename) => {
  if (!filename) throw new ValidationError("Filename is required");

  // Remove path separators and suspicious characters
  return filename
    .replace(/\.\./g, "")
    .replace(/[\/\\]/g, "")
    .substring(0, 255);
};

/**
 * Validates Ethereum address format
 */
export const validateEthereumAddress = (address) => {
  if (!address) throw new ValidationError("Address is required");
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new ValidationError("Invalid Ethereum address format");
  }
};

/**
 * Validates IPFS CID format
 */
export const validateIpfsCid = (cid) => {
  if (!cid) throw new ValidationError("IPFS CID is required");
  if (!/^[a-zA-Z0-9]{46,}$/.test(cid)) {
    throw new ValidationError("Invalid IPFS CID format");
  }
};

export const FILE_VALIDATION = {
  IMAGE_EXTENSIONS,
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
};
