import { Router } from "express";
import { getAnalyticsSummary } from "../controllers/analyticsController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/summary", protect, getAnalyticsSummary);

export default router;
