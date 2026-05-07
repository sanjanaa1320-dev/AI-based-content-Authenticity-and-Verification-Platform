import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const getLogFile = (level) => {
  const date = new Date().toISOString().split("T")[0];
  return path.join(LOG_DIR, `${level}-${date}.log`);
};

const formatLog = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}`.trim();
};

const writeLog = (level, message, meta = {}) => {
  const logLine = formatLog(level, message, meta);

  // Console output
  const consoleMethod = level === "error" ? console.error : console.log;
  consoleMethod(logLine);

  // File output
  try {
    fs.appendFileSync(getLogFile(level), logLine + "\n");
  } catch (error) {
    console.error(`Failed to write log file: ${error.message}`);
  }
};

export const logger = {
  info: (message, meta) => writeLog("info", message, meta),
  warn: (message, meta) => writeLog("warn", message, meta),
  error: (message, meta) => writeLog("error", message, meta),
  debug: (message, meta) => writeLog("debug", message, meta),
};
