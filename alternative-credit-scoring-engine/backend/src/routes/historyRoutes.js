import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getStatementHistory, getStatementHistoryItem } from "../controllers/historyController.js";

const router = Router();

router.get("/history", protect, getStatementHistory);
router.get("/history/:statementId", protect, getStatementHistoryItem);

export default router;
