# AI-based-content-Authenticity-and-Verification-Platform

AI-based-content-Authenticity-and-Verification-Platform is a full-stack system for registering and verifying digital content provenance. It combines a React frontend, an Express API, SHA-256 hashing, optional visible image watermarking, IPFS pinning through Pinata, and an on-chain Solidity registry.

## What It Does

- Registers images, video, audio, PDFs, documents, spreadsheets, presentations, CSV, and text files.
- Calculates a SHA-256 fingerprint for the original file.
- Applies a visible watermark and perceptual hash for image files when supported.
- Pins registered content to IPFS through Pinata.
- Stores proof metadata on a Solidity smart contract.
- Verifies uploaded files by checking their SHA-256 hash against the blockchain registry.
- Provides health checks for backend, RPC, contract, CORS, and Pinata configuration.

## Tech Stack

| Area | Technology |
| :--- | :--- |
| Frontend | React, Vite, Axios |
| Backend | Node.js, Express, Multer |
| Blockchain | Solidity, Hardhat 3, Ethers.js |
| Storage | Pinata IPFS |
| Hashing | Node.js crypto, Jimp |
| Hosting | Render for backend, Vercel for frontend |
| Network | Sepolia testnet for online deployment |

## Project Structure

```text
.
├── backend
│   ├── index.js
│   ├── src
│   └── blockchain
│       ├── contracts
│       ├── scripts
│       └── ignition
├── frontend
│   └── src
├── package.json
└── README.md
```

## Local Development

Install dependencies in each app folder:

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ../backend/blockchain && npm install
```

Create local env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On Windows PowerShell, use:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

### Backend Env

For local Hardhat development, `backend/.env` should look like:

```env
PORT=3001
CORS_ORIGIN=http://localhost:5173
RPC_URL=http://127.0.0.1:8545/
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
PRIVATE_KEY=
PINATA_JWT_TOKEN=your_pinata_jwt_token
WATERMARK_STRICT=false
```

You can use `PINATA_API_KEY` and `PINATA_API_SECRET` instead of `PINATA_JWT_TOKEN`, but JWT is recommended.

### Frontend Env

`frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3001
```

### Run Local Blockchain

Terminal 1:

```bash
cd backend/blockchain
npx hardhat node
```

### Deploy Contract Locally

Terminal 2:

```bash
cd backend/blockchain
npx hardhat ignition deploy ignition/modules/DeployRegistry.ts --network localhost
```

Copy the deployed address into `backend/.env` as `CONTRACT_ADDRESS`.

### Run Backend

Terminal 3:

```bash
cd backend
npm run dev
```

Backend routes:

```text
http://localhost:3001/api
http://localhost:3001/api/health
```

### Run Frontend

Terminal 4:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

## Online Deployment

Recommended production-style setup:

```text
Vercel frontend -> Render backend -> Sepolia contract + Pinata IPFS
```

Never commit `.env` files or private keys.

## Deploy Contract To Sepolia

Create `backend/blockchain/.env` or provide these values in your shell:

```env
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_alchemy_key
PRIVATE_KEY=your_test_wallet_private_key
```

The wallet must have Sepolia ETH for gas.

Deploy:

```bash
cd backend/blockchain
npx hardhat run scripts/deploy.js --network sepolia
```

The command prints:

```text
Contract deployed to: 0x...
```

Use that address as `CONTRACT_ADDRESS` in Render.

Current Sepolia contract used during setup:

```env
CONTRACT_ADDRESS=0x8fcb2250100140C46a45F609C2D51679314De369
```

## Deploy Backend To Render

Create a Render Web Service from the GitHub repo.

Use these settings:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

Add these Render environment variables:

```env
PORT=5000
CORS_ORIGIN=https://your-vercel-app.vercel.app
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_alchemy_key
CONTRACT_ADDRESS=0x8fcb2250100140C46a45F609C2D51679314De369
PRIVATE_KEY=your_test_wallet_private_key
PINATA_JWT_TOKEN=your_pinata_jwt_token
WATERMARK_STRICT=false
```

If the Vercel URL is not known yet, temporarily use:

```env
CORS_ORIGIN=https://*.vercel.app
```

After deployment, verify:

```text
https://your-render-service.onrender.com/api
https://your-render-service.onrender.com/api/health
```

The health route should return `"status": "ok"` when RPC, contract, and Pinata are configured correctly.

## Deploy Frontend To Vercel

Create a Vercel project from the GitHub repo.

Use these settings:

```text
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Add this Vercel environment variable:

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com
```

Do not add backend secrets to Vercel. `PRIVATE_KEY`, `PINATA_JWT_TOKEN`, `RPC_URL`, and `CONTRACT_ADDRESS` belong in Render.

After Vercel deploys, update Render:

```env
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

Then restart or redeploy the Render service.

## API Overview

```text
GET  /api
GET  /api/health
POST /api/upload
POST /api/verify
```

`POST /api/upload` expects multipart form data with field name `file`.

`POST /api/verify` expects multipart form data with field name `file`.

## Supported File Types

- Images: JPG, JPEG, PNG, WEBP, BMP, GIF, TIF, TIFF
- Video: MP4, MOV, WEBM, MKV, AVI, M4V
- Audio: MP3, WAV, OGG, M4A, FLAC, AAC
- Documents: PDF, CSV, TXT, DOC, DOCX, XLS, XLSX, PPT, PPTX

Maximum upload size: 100 MB.

## Useful Commands

Frontend build:

```bash
cd frontend
npm run build
```

Backend syntax check:

```bash
cd backend
node --check index.js
```

Compile smart contract:

```bash
cd backend/blockchain
npx hardhat compile
```

Deploy to Sepolia:

```bash
cd backend/blockchain
npx hardhat run scripts/deploy.js --network sepolia
```

## Notes

- Use a test wallet for Sepolia. Do not use a wallet that holds real funds.
- Pinata credentials are required for upload/register.
- Verification can read from the blockchain contract as long as RPC and contract address are valid.
- Local Hardhat contract addresses do not work online. Render must use a Sepolia or other public-network contract address.
