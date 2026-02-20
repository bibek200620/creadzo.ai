import { Router } from "express";
import multer from "multer";
import { uploadBankStatement } from "../controllers/bankController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    if (lower.endsWith(".pdf") || lower.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only .pdf and .csv files are allowed"));
    }
  },
});

router.post("/upload", protect, upload.single("statement"), uploadBankStatement);

export default router;
