import { Router } from "express";
import { exportScoreReport, generateScore } from "../controllers/scoreController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/generate", protect, generateScore);
router.get("/report", protect, exportScoreReport);
router.get("/report/:statementId", protect, exportScoreReport);

export default router;
