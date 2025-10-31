import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { protect } from "../middleware/authMiddleware.js"; // your middleware

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer config
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Only .jpg, .jpeg, .png, .webp files are allowed!"));
  },
});

// Deterministic filename based on userId + original name
function getDeterministicFilename(userId, originalName) {
  const hash = crypto.createHash("md5").update(userId + originalName).digest("hex");
  return hash + path.extname(originalName);
}

function saveFileForUser(userId, buffer, originalName) {
  const filename = getDeterministicFilename(userId, originalName);
  const filepath = path.join(uploadDir, filename);
  fs.writeFileSync(filepath, buffer); // overwrite if exists
  return filename;
}

// Single upload route (protected)
router.post("/upload", protect, upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const userId = req.user._id.toString();
    const filename = saveFileForUser(userId, req.file.buffer, req.file.originalname);

    // Return only the filename for DB
    res.json({ success: true, filename });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Multiple upload route (protected)
router.post("/upload/multiple", protect, upload.array("files", 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: "No files uploaded" });

    const userId = req.user._id.toString();
    const uploadedFilenames = [];

    req.files.forEach((file) => {
      const filename = saveFileForUser(userId, file.buffer, file.originalname);
      uploadedFilenames.push(filename);
    });

    // Return only filenames for DB
    res.json({ success: true, uploaded: uploadedFilenames });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
