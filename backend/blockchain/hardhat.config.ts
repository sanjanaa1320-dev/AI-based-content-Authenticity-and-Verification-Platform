import { defineConfig } from "hardhat/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// 1. Import the plugin we installed
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const configDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDir, ".env"), quiet: true });
dotenv.config({ path: path.resolve(configDir, "../.env"), quiet: true });

const RPC_URL = (process.env.RPC_URL || "").trim();
const SEPOLIA_RPC_URL = (process.env.SEPOLIA_RPC_URL || RPC_URL).trim();
const ALCHEMY_AMOY_URL = (process.env.ALCHEMY_AMOY_URL || "").trim();
const rawPrivateKey = (process.env.PRIVATE_KEY || "").trim();
const PRIVATE_KEY = rawPrivateKey
  ? (rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`)
  : "";
const WALLET_MNEMONIC = process.env.WALLET_MNEMONIC || "";
const hasSepoliaUrl = Boolean(SEPOLIA_RPC_URL);
const hasAmoyUrl = Boolean(ALCHEMY_AMOY_URL);
const hasPrivateKey = Boolean(PRIVATE_KEY.trim());
const hasWalletMnemonic = Boolean(WALLET_MNEMONIC.trim());
const hasWalletConfig = hasPrivateKey || hasWalletMnemonic;

if ((hasSepoliaUrl || hasAmoyUrl) && !hasWalletConfig) {
  console.warn(
    "Set PRIVATE_KEY (recommended) or WALLET_MNEMONIC to enable deployment."
  );
}
if (!hasSepoliaUrl && !hasAmoyUrl && hasWalletConfig) {
  console.warn(
    "Set RPC_URL/SEPOLIA_RPC_URL (for Sepolia) or ALCHEMY_AMOY_URL (for Amoy)."
  );
}
if (hasPrivateKey && hasWalletMnemonic) {
  console.warn("Both PRIVATE_KEY and WALLET_MNEMONIC are set. PRIVATE_KEY will be used.");
}

const accountsConfig = hasPrivateKey
  ? [PRIVATE_KEY]
  : hasWalletMnemonic
  ? {
      mnemonic: WALLET_MNEMONIC,
      path: "m/44'/60'/0'/0",
      initialIndex: 0,
      count: 1,
    }
  : undefined;

const config = defineConfig({
  networks: {
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545/",
    },
    ...(hasSepoliaUrl && {
      sepolia: {
        type: "http",
        chainType: "l1",
        url: SEPOLIA_RPC_URL,
        ...(accountsConfig ? { accounts: accountsConfig } : {}),
      },
    }),
    ...(hasAmoyUrl && {
      amoy: {
        type: "http",
        chainType: "l1",
        url: ALCHEMY_AMOY_URL,
        ...(accountsConfig ? { accounts: accountsConfig } : {}),
      },
    }),
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.24",
      },
      production: {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  plugins: [hardhatToolboxMochaEthers],
});

export default config;
