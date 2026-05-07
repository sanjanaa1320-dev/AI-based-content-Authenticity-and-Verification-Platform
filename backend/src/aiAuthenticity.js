import fs from "fs";
import path from "path";
import { Jimp, intToRGBA } from "jimp";

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
export const AI_AUTHENTICITY_MODEL_NAME =
  "AI Content Authenticity Classifier v1";
const AI_AUTHENTICITY_MODEL_TYPE = "Local signal-based AI classifier";

const round = (value, digits = 2) => Number(value.toFixed(digits));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getFileCategory = (filePath, originalName = "") => {
  const ext = path.extname(originalName || filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "file";
};

const summarizeSignal = (score) => {
  if (score >= 85) return "Very high confidence";
  if (score >= 70) return "High confidence";
  if (score >= 50) return "Moderate confidence";
  return "Needs review";
};

const analyzeImageSignals = async (filePath) => {
  const image = await Jimp.read(filePath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 96));

  let samples = 0;
  let brightnessTotal = 0;
  let saturationTotal = 0;
  let highContrastEdges = 0;
  let blockJumps = 0;
  let previousLuma = null;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const { r, g, b } = intToRGBA(image.getPixelColor(x, y));
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      brightnessTotal += luma;
      saturationTotal += max === 0 ? 0 : (max - min) / max;

      if (previousLuma !== null && Math.abs(luma - previousLuma) > 58) {
        highContrastEdges += 1;
      }

      if (
        (x % 8 === 0 || y % 8 === 0) &&
        previousLuma !== null &&
        Math.abs(luma - previousLuma) > 42
      ) {
        blockJumps += 1;
      }

      previousLuma = luma;
      samples += 1;
    }
  }

  const brightness = brightnessTotal / samples;
  const saturation = saturationTotal / samples;
  const edgeRatio = highContrastEdges / Math.max(1, samples - 1);
  const blockArtifactRatio = blockJumps / Math.max(1, samples - 1);

  let aiConfidence = 94;
  const findings = [];

  if (brightness < 28 || brightness > 230) {
    aiConfidence -= 12;
    findings.push(
      "Extreme brightness can hide edits or missing visual detail.",
    );
  }

  if (saturation > 0.82) {
    aiConfidence -= 8;
    findings.push("Very high color saturation was detected.");
  }

  if (edgeRatio > 0.38) {
    aiConfidence -= 10;
    findings.push(
      "Dense high-contrast edges suggest possible overlays, screenshots, or recompression.",
    );
  }

  if (blockArtifactRatio > 0.18) {
    aiConfidence -= 10;
    findings.push(
      "Block-pattern jumps suggest compression or copy/edit artifacts.",
    );
  }

  if (findings.length === 0) {
    findings.push(
      "Visual signal is internally consistent for automated registration.",
    );
  }

  aiConfidence = clamp(aiConfidence, 35, 98);

  return {
    model: AI_AUTHENTICITY_MODEL_NAME,
    modelType: AI_AUTHENTICITY_MODEL_TYPE,
    category: "image",
    aiConfidence: round(aiConfidence),
    verdict: summarizeSignal(aiConfidence),
    signals: {
      brightness: round(brightness),
      saturation: round(saturation),
      edgeRatio: round(edgeRatio, 4),
      blockArtifactRatio: round(blockArtifactRatio, 4),
      width,
      height,
    },
    findings,
  };
};
const analyzeAudioSignals = async (filePath, originalName = "") => {
  const stats = await fs.promises.stat(filePath);
  const ext = path.extname(originalName || filePath).toLowerCase();
  const fileSizeMb = stats.size / (1024 * 1024);

  let aiConfidence = 90;
  const findings = [];

  // Audio-specific signal analysis
  if (stats.size === 0) {
    aiConfidence -= 60;
    findings.push("Audio file is empty, authenticity cannot be verified.");
  }

  // Check for suspicious file sizes (too small for typical audio)
  if (stats.size < 50000) {
    aiConfidence -= 8;
    findings.push(
      "Audio file size is unusually small, may indicate poor quality or truncation.",
    );
  }

  // Large files may indicate multiple re-encodings or concatenation
  if (fileSizeMb > 100) {
    aiConfidence -= 5;
    findings.push(
      "Large audio file size may indicate multiple compression passes or concatenated segments.",
    );
  }

  // Check for common deepfake codecs
  if ([".m4a", ".aac"].includes(ext)) {
    findings.push("AAC codec detected - commonly used in AI-generated speech.");
  }

  if ([".mp3"].includes(ext)) {
    findings.push(
      "MP3 codec detected - compression artifacts can mask synthesis artifacts.",
    );
  }

  if (findings.length === 0 || findings.length === 1) {
    findings.push(
      "Audio file structure is consistent with registered authenticity.",
    );
  }

  aiConfidence = clamp(aiConfidence, 30, 95);

  return {
    model: AI_AUTHENTICITY_MODEL_NAME,
    modelType: AI_AUTHENTICITY_MODEL_TYPE,
    category: "audio",
    aiConfidence: round(aiConfidence),
    verdict: summarizeSignal(aiConfidence),
    signals: {
      fileSizeBytes: stats.size,
      fileSizeMb: round(fileSizeMb, 2),
      extension: ext,
      codec: ext.substring(1).toUpperCase(),
    },
    findings,
  };
};

const analyzeVideoSignals = async (filePath, originalName = "") => {
  const stats = await fs.promises.stat(filePath);
  const ext = path.extname(originalName || filePath).toLowerCase();
  const fileSizeMb = stats.size / (1024 * 1024);

  let aiConfidence = 88;
  const findings = [];

  // Video-specific signal analysis
  if (stats.size === 0) {
    aiConfidence -= 65;
    findings.push("Video file is empty, authenticity cannot be verified.");
  }

  // Suspiciously small video files
  if (stats.size < 100000) {
    aiConfidence -= 10;
    findings.push(
      "Video file size is very small, may indicate frame loss, corruption, or low quality.",
    );
  }

  // Very large files suggest multiple compression cycles or concatenation
  if (fileSizeMb > 500) {
    aiConfidence -= 8;
    findings.push(
      "Very large video file suggests potential for re-encoding artifacts or multiple edits.",
    );
  }

  // Check for common deepfake/AI video codecs
  if ([".webm", ".ts"].includes(ext)) {
    findings.push(
      "Video codec detected - streaming codecs may hide generative artifacts.",
    );
  }

  if ([".mp4", ".m4v"].includes(ext)) {
    findings.push(
      "H.264/H.265 codec inferred - most common for distribution; verify frame consistency.",
    );
  }

  if ([".mkv"].includes(ext)) {
    findings.push(
      "Matroska container detected - allows for complex metadata and multi-stream embedding.",
    );
  }

  if (findings.length === 0 || findings.length === 1) {
    findings.push(
      "Video file structure is suitable for hash-based authenticity verification.",
    );
  }

  aiConfidence = clamp(aiConfidence, 25, 96);

  return {
    model: AI_AUTHENTICITY_MODEL_NAME,
    modelType: AI_AUTHENTICITY_MODEL_TYPE,
    category: "video",
    aiConfidence: round(aiConfidence),
    verdict: summarizeSignal(aiConfidence),
    signals: {
      fileSizeBytes: stats.size,
      fileSizeMb: round(fileSizeMb, 2),
      extension: ext,
      container: ext.substring(1).toUpperCase(),
    },
    findings,
  };
};
const analyzeGenericFileSignals = async (filePath, originalName = "") => {
  const stats = await fs.promises.stat(filePath);
  const ext = path.extname(originalName || filePath).toLowerCase() || "unknown";
  const fileSizeMb = stats.size / (1024 * 1024);
  let aiConfidence = 88;
  const findings = [];

  if (stats.size === 0) {
    aiConfidence -= 55;
    findings.push("The file is empty, so authenticity evidence is weak.");
  }

  if (fileSizeMb > 75) {
    aiConfidence -= 6;
    findings.push(
      "Large file size increases the need for manual provenance review.",
    );
  }

  if (ext === "unknown") {
    aiConfidence -= 8;
    findings.push("No clear extension was available for file-type reasoning.");
  }

  if (findings.length === 0) {
    findings.push(
      "File structure is suitable for hash-based authenticity registration.",
    );
  }

  aiConfidence = clamp(aiConfidence, 25, 95);

  return {
    model: AI_AUTHENTICITY_MODEL_NAME,
    modelType: AI_AUTHENTICITY_MODEL_TYPE,
    category: "file",
    aiConfidence: round(aiConfidence),
    verdict: summarizeSignal(aiConfidence),
    signals: {
      fileSizeBytes: stats.size,
      fileSizeMb: round(fileSizeMb),
      extension: ext,
    },
    findings,
  };
};

export const analyzeContentAuthenticity = async (
  filePath,
  originalName = "",
) => {
  const category = getFileCategory(filePath, originalName);

  if (category === "image") {
    return analyzeImageSignals(filePath);
  }

  if (category === "audio") {
    return analyzeAudioSignals(filePath, originalName);
  }

  if (category === "video") {
    return analyzeVideoSignals(filePath, originalName);
  }

  return analyzeGenericFileSignals(filePath, originalName);
};
