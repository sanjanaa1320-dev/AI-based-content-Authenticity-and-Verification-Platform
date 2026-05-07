import React, { useState } from "react";
import axios from "axios";
import "./App.css";

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
).replace(/\/$/, "");
const AI_MODEL_TYPE = "Browser/local signal-based AI classifier";
const IS_BROWSER_LOCALHOST =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_POINTS_TO_LOCALHOST = /localhost|127\.0\.0\.1/.test(API_BASE_URL);
const ACCEPTED_FILE_TYPES =
  "image/*,video/*,audio/*,.pdf,.csv,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "bmp",
  "gif",
  "tif",
  "tiff",
  "mp4",
  "mov",
  "webm",
  "mkv",
  "avi",
  "m4v",
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "flac",
  "aac",
  "pdf",
  "csv",
  "txt",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
]);

function App() {
  // ... (All your existing useState hooks are correct)
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [verifyFile, setVerifyFile] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const getRequestErrorMessage = (error) => {
    const serverError = error?.response?.data?.error;
    const serverHint = error?.response?.data?.hint;

    if (serverError) {
      return serverHint ? `${serverError} (${serverHint})` : serverError;
    }

    // Browser blocked request before server response (usually CORS/network misconfig)
    if (!error?.response) {
      if (!IS_BROWSER_LOCALHOST && API_POINTS_TO_LOCALHOST) {
        return "Frontend API is still pointing to localhost. Set VITE_API_BASE_URL in Vercel to your Render backend URL.";
      }

      return "Could not connect to server. Check VITE_API_BASE_URL, Render service status, and backend CORS_ORIGIN.";
    }

    return "Could not connect to server.";
  };

  const validateSelectedFile = (file) => {
    if (!file) return { valid: false, message: "Please select a file." };

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        message: "File too large. Maximum allowed size is 100 MB.",
      };
    }

    const ext = file.name.includes(".")
      ? file.name.split(".").pop().toLowerCase()
      : "";
    const type = (file.type || "").toLowerCase();
    const isAllowedByMime =
      type.startsWith("image/") ||
      type.startsWith("video/") ||
      type.startsWith("audio/");
    const isAllowedByExt = ALLOWED_EXTENSIONS.has(ext);

    if (!isAllowedByMime && !isAllowedByExt) {
      return {
        valid: false,
        message:
          "Unsupported file type. Allowed: images, MP4/video, MP3/audio, PDF, CSV, TXT, DOC/DOCX, XLS/XLSX, PPT/PPTX.",
      };
    }

    return { valid: true };
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const round = (value, digits = 2) => Number(value.toFixed(digits));

  const summarizeSignal = (score) => {
    if (score >= 85) return "Very high confidence";
    if (score >= 70) return "High confidence";
    if (score >= 50) return "Moderate confidence";
    return "Needs review";
  };

  const analyzeGenericFileInBrowser = (file) => {
    const ext = file.name.includes(".")
      ? `.${file.name.split(".").pop().toLowerCase()}`
      : "unknown";
    const fileSizeMb = file.size / (1024 * 1024);
    let aiConfidence = 88;
    const findings = [];

    if (file.size === 0) {
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
      findings.push(
        "No clear extension was available for file-type reasoning.",
      );
    }

    if (findings.length === 0) {
      findings.push(
        "File structure is suitable for hash-based authenticity registration.",
      );
    }

    aiConfidence = clamp(aiConfidence, 25, 95);

    return {
      modelType: AI_MODEL_TYPE,
      category: "file",
      aiConfidence: round(aiConfidence),
      verdict: summarizeSignal(aiConfidence),
      signals: {
        fileSizeBytes: file.size,
        fileSizeMb: round(fileSizeMb),
        extension: ext,
      },
      findings,
    };
  };

  const analyzeImageInBrowser = (file) =>
    new Promise((resolve) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const sampleStep = Math.max(
          1,
          Math.floor(Math.min(width, height) / 96),
        );
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, width, height);

        let samples = 0;
        let brightnessTotal = 0;
        let saturationTotal = 0;
        let highContrastEdges = 0;
        let blockJumps = 0;
        let previousLuma = null;

        for (let y = 0; y < height; y += sampleStep) {
          for (let x = 0; x < width; x += sampleStep) {
            const [r, g, b] = context.getImageData(x, y, 1, 1).data;
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

        URL.revokeObjectURL(objectUrl);
        aiConfidence = clamp(aiConfidence, 35, 98);

        resolve({
          modelType: AI_MODEL_TYPE,
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
        });
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(analyzeGenericFileInBrowser(file));
      };

      image.src = objectUrl;
    });

  const analyzeFileInBrowser = async (file) => {
    if (!file) return null;
    if ((file.type || "").toLowerCase().startsWith("image/")) {
      return analyzeImageInBrowser(file);
    }

    return analyzeGenericFileInBrowser(file);
  };

  // --- (onUploadFileChange, onFileUpload, onVerifyFileChange, onFileVerify, formatTimestamp functions are all correct) ---
  const onUploadFileChange = (event) => {
    const selectedFile = event.target.files[0];
    const validation = validateSelectedFile(selectedFile);
    if (!validation.valid) {
      setUploadFile(null);
      setUploadResult({ message: validation.message, isError: true });
      event.target.value = null;
      return;
    }
    setUploadFile(selectedFile);
    setUploadResult(null);
  };

  const onFileUpload = async () => {
    if (!uploadFile) {
      setUploadResult({
        message: "Please select a file to register.",
        isError: true,
      });
      return;
    }
    setIsUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("file", uploadFile);
    const localAiAnalysis = await analyzeFileInBrowser(uploadFile);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      console.log("Upload response:", response.data);
      setUploadResult({
        ...response.data,
        aiAnalysis: response.data.aiAnalysis || localAiAnalysis,
        isError: false,
      });
      setUploadFile(null);
      document.getElementById("upload-input").value = null;
    } catch (error) {
      console.error("Error uploading file:", error);
      const responseData = error?.response?.data || {};
      setUploadResult({
        ...responseData,
        message: getRequestErrorMessage(error),
        aiAnalysis: responseData.aiAnalysis || localAiAnalysis,
        isError: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onVerifyFileChange = (event) => {
    const selectedFile = event.target.files[0];
    const validation = validateSelectedFile(selectedFile);
    if (!validation.valid) {
      setVerifyFile(null);
      setVerifyResult({ message: validation.message, isAuthentic: null });
      event.target.value = null;
      return;
    }
    setVerifyFile(selectedFile);
    setVerifyResult(null);
  };

  const onFileVerify = async () => {
    if (!verifyFile) {
      setVerifyResult({ message: "Please select a file to verify." });
      return;
    }
    setIsVerifying(true);
    setVerifyResult(null);
    const formData = new FormData();
    formData.append("file", verifyFile);
    const localAiAnalysis = await analyzeFileInBrowser(verifyFile);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/verify`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      console.log("Verify response:", response.data);
      setVerifyResult({
        ...response.data,
        aiAnalysis:
          response.data.aiAnalysis ||
          response.data.record?.aiAnalysis ||
          localAiAnalysis,
      });
    } catch (error) {
      console.error("Error verifying file:", error);
      const responseData = error?.response?.data || {};
      setVerifyResult({
        ...responseData,
        message: getRequestErrorMessage(error),
        aiAnalysis: responseData.aiAnalysis || localAiAnalysis,
      });
    } finally {
      setIsVerifying(false);
      setVerifyFile(null);
      document.getElementById("verify-input").value = null;
    }
  };

  const formatTimestamp = (bigIntString) => {
    if (!bigIntString) return "N/A";
    const timestampInMs = parseInt(bigIntString) * 1000;
    return new Date(timestampInMs).toLocaleString();
  };

  // --- NEW DOWNLOAD HANDLER ---
  const handleDownload = async (cid, filename) => {
    try {
      // 1. Fetch the file from the cross-origin URL
      const response = await fetch(IPFS_GATEWAY + cid);
      const blob = await response.blob();

      // 2. Create a temporary local URL (same-origin)
      const blobUrl = URL.createObjectURL(blob);

      // 3. Create a temporary link to click
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename || `genesis-download-${cid.substring(0, 6)}`; // Set a default filename

      // 4. Programmatically click the link
      document.body.appendChild(link);
      link.click();

      // 5. Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  const renderUploadPreview = () => {
    if (!uploadResult || uploadResult.isError) return null;

    if (uploadResult.fileCategory === "image" || uploadResult.isImage) {
      return (
        <img
          src={IPFS_GATEWAY + uploadResult.ipfsCid}
          alt="Registered Content Preview"
          className="preview-image"
        />
      );
    }

    if (uploadResult.fileCategory === "video") {
      return (
        <video controls className="preview-media">
          <source
            src={IPFS_GATEWAY + uploadResult.ipfsCid}
            type={uploadResult.mimetype}
          />
          Your browser does not support video preview.
        </video>
      );
    }

    if (uploadResult.fileCategory === "audio") {
      return (
        <audio controls className="preview-audio">
          <source
            src={IPFS_GATEWAY + uploadResult.ipfsCid}
            type={uploadResult.mimetype}
          />
          Your browser does not support audio preview.
        </audio>
      );
    }

    return (
      <p className="inline-note">
        Preview is available for image/video/audio files. Use download for this
        file.
      </p>
    );
  };

  const renderAiAnalysis = (aiAnalysis) => {
    const hasAnalysis = Boolean(aiAnalysis);
    const isImageAnalysis = aiAnalysis?.category === "image";
    const checkedSignals = isImageAnalysis
      ? "Checks brightness, saturation, edge patterns, and compression-like artifacts."
      : "Checks file structure signals such as file size and extension.";
    const confidence = hasAnalysis
      ? `${aiAnalysis.aiConfidence}%`
      : "Not returned";
    const verdict = hasAnalysis
      ? aiAnalysis.verdict
      : "Backend AI result not available yet";
    const findings =
      hasAnalysis &&
      Array.isArray(aiAnalysis.findings) &&
      aiAnalysis.findings.length > 0
        ? aiAnalysis.findings
        : ["Select a file to generate AI findings."];

    return (
      <div className="ai-analysis">
        <div className="ai-analysis-head">
          <span>AI Authenticity Analysis</span>
          <strong>{confidence}</strong>
        </div>
        <div className="ai-meter" aria-label={`AI confidence ${confidence}`}>
          <span
            style={{
              width: hasAnalysis
                ? `${Math.min(100, Math.max(0, aiAnalysis.aiConfidence))}%`
                : "0%",
            }}
          />
        </div>
        <div className="ai-result-grid">
          <span>AI Confidence Score</span>
          <strong>{confidence}</strong>
          <span>Verdict</span>
          <strong>{verdict}</strong>
        </div>
        <p className="ai-signal-summary">{checkedSignals}</p>
        <h4>Findings</h4>
        <ul>
          {findings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      </div>
    );
  };

  const getAiAnalysis = (result) =>
    result?.aiAnalysis || result?.record?.aiAnalysis || null;

  return (
    <div className="app-shell">
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
      <div className="bg-grid" />

      <header className="hero">
        <p className="eyebrow">
          AI-based-content-Authenticity-and-Verification-Platform
        </p>
        <h1>AI based content Authenticity and Verification Platform</h1>
        <p className="hero-copy">
          Register and verify images, video, audio, and documents with AI
          authenticity scoring, SHA-256 fingerprints, IPFS permanence, and
          on-chain proof.
        </p>
        <div className="hero-chips">
          <span>AI Authenticity Score</span>
          <span>Blockchain Registry</span>
          <span>IPFS Pinning</span>
          <span>File Verify</span>
        </div>
      </header>

      <main className="panel-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Register Asset</h2>
            <p>Upload once. Register forever.</p>
          </div>

          <div className="input-group">
            <label htmlFor="upload-input">Select file</label>
            <input
              id="upload-input"
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={onUploadFileChange}
            />
            <button
              onClick={onFileUpload}
              disabled={isUploading}
              className="primary-btn"
            >
              {isUploading ? "Registering..." : "Register File"}
            </button>
          </div>

          {uploadResult && (
            <div className="result-card">
              <p
                className={
                  uploadResult.isError ? "message-error" : "message-success"
                }
              >
                <span className="status-icon">
                  {uploadResult.isError ? "❌" : "✔️"}
                </span>
                {uploadResult.message}
              </p>

              {uploadResult.isError &&
                renderAiAnalysis(getAiAnalysis(uploadResult))}

              {!uploadResult.isError && (
                <div className="record-details">
                  <h3 className="status-authentic">Registered</h3>
                  {renderUploadPreview()}
                  {renderAiAnalysis(getAiAnalysis(uploadResult))}
                  <pre>
                    <strong>SHA-256:</strong>{" "}
                    <span className="hash-value">{uploadResult.sha256}</span>
                    <br />
                    <strong>IPFS CID:</strong>{" "}
                    <span className="hash-value">{uploadResult.ipfsCid}</span>
                  </pre>
                  <button
                    onClick={() =>
                      handleDownload(
                        uploadResult.ipfsCid,
                        uploadResult.filename,
                      )
                    }
                    className="download-button"
                  >
                    Download Registered File
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Verify Authenticity</h2>
            <p>Verify by file hash against on-chain records.</p>
          </div>

          <div className="input-group">
            <label htmlFor="verify-input">Verify by file</label>
            <input
              id="verify-input"
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={onVerifyFileChange}
            />
            <button
              onClick={onFileVerify}
              disabled={isVerifying}
              className="primary-btn"
            >
              {isVerifying ? "Verifying..." : "Verify File"}
            </button>
          </div>

          {verifyResult && (
            <div className="result-card">
              <p
                className={
                  verifyResult.isAuthentic === true
                    ? "message-success"
                    : "message-error"
                }
              >
                <span className="status-icon">
                  {verifyResult.isAuthentic === true ? "✔️" : "❌"}
                </span>
                {verifyResult.message}
              </p>
              {verifyResult.isAuthentic !== true &&
                verifyResult.isAuthentic !== false &&
                renderAiAnalysis(getAiAnalysis(verifyResult))}
              {verifyResult.isAuthentic === true && (
                <div className="record-details">
                  <h3 className="status-authentic">Authentic</h3>
                  {renderAiAnalysis(getAiAnalysis(verifyResult))}
                  <pre>
                    <strong>Creator:</strong>{" "}
                    <span className="hash-value">
                      {verifyResult.record.creator}
                    </span>
                    <br />
                    <strong>Timestamp:</strong>{" "}
                    <span className="hash-value">
                      {formatTimestamp(verifyResult.record.timestamp)}
                    </span>
                    <br />
                    <strong>IPFS CID:</strong>{" "}
                    <span className="hash-value">
                      {verifyResult.record.ipfsCid}
                    </span>
                    <br />
                    <strong>SHA-256:</strong>{" "}
                    <span className="hash-value">
                      {verifyResult.record.sha256}
                    </span>
                  </pre>
                </div>
              )}
              {verifyResult.isAuthentic === false && (
                <div className="record-details">
                  <h3 className="status-not-found">Not Found</h3>
                  {renderAiAnalysis(getAiAnalysis(verifyResult))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
