import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getAnalysisRecordHistory,
  getLatestAnalysisRecord,
  saveAnalysisRecord,
} from "../controllers/analysisRecordController.js";

const router = Router();

router.post("/save", protect, saveAnalysisRecord);
router.get("/latest", protect, getLatestAnalysisRecord);
router.get("/history", protect, getAnalysisRecordHistory);

export default router;
