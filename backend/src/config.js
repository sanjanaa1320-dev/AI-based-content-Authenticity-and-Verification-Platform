const requiredEnvVars = ["PORT", "CORS_ORIGIN", "RPC_URL", "CONTRACT_ADDRESS"];

const optionalEnvVars = [
  "PRIVATE_KEY",
  "PINATA_JWT_TOKEN",
  "PINATA_API_KEY",
  "PINATA_API_SECRET",
  "WATERMARK_STRICT",
  "NODE_ENV",
];

export const validateEnvironment = () => {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check Pinata credentials
  const hasPinataJwt = Boolean(process.env.PINATA_JWT_TOKEN?.trim());
  const hasPinataKeys = Boolean(
    process.env.PINATA_API_KEY?.trim() && process.env.PINATA_API_SECRET?.trim(),
  );

  if (!hasPinataJwt && !hasPinataKeys) {
    warnings.push(
      "Pinata credentials missing. IPFS uploads will fail. Set PINATA_JWT_TOKEN or PINATA_API_KEY + PINATA_API_SECRET.",
    );
  }

  // Check PRIVATE_KEY for non-local networks
  const isLocalRpc = /127\.0\.0\.1|localhost/.test(process.env.RPC_URL || "");
  if (!isLocalRpc && !process.env.PRIVATE_KEY?.trim()) {
    missing.push("PRIVATE_KEY (required for non-local RPC networks)");
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
};

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  corsOrigin: (process.env.CORS_ORIGIN || "").trim(),
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545/",
  contractAddress:
    process.env.CONTRACT_ADDRESS ||
    "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  privateKey: process.env.PRIVATE_KEY?.trim() || "",
  pinataJwtToken: process.env.PINATA_JWT_TOKEN?.trim() || "",
  pinataApiKey: process.env.PINATA_API_KEY?.trim() || "",
  pinataApiSecret: process.env.PINATA_API_SECRET?.trim() || "",
  watermarkStrict: process.env.WATERMARK_STRICT === "true",
  nodeEnv: process.env.NODE_ENV || "development",
  maxFileSize: 100 * 1024 * 1024, // 100 MB
  uploadDir: "uploads",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment:
    process.env.NODE_ENV === "development" || !process.env.NODE_ENV,
};
