import Statement from "../models/Statement.js";
import { parseUploadedStatement } from "../services/parserService.js";
import { computeAnalytics } from "../services/analyticsService.js";
import { generateTrustScore } from "../services/scoringService.js";
import { generateRecommendations } from "../services/recommendationService.js";

export async function uploadBankStatement(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Statement file is required" });
    }

    const { fileType, transactions } = await parseUploadedStatement(req.file);

    if (!transactions.length) {
      return res.status(422).json({ message: "No valid transactions found in the uploaded file" });
    }

    const analytics = computeAnalytics(transactions);
    const score = generateTrustScore(analytics);
    const recommendations = generateRecommendations(analytics, score);

    const statement = await Statement.create({
      user: req.user._id,
      fileName: req.file.originalname,
      fileType,
      transactions,
      analytics,
      score,
      recommendations,
    });

    return res.status(201).json({
      message: "Statement uploaded and analyzed successfully",
      statementId: statement._id,
      analytics,
      score,
      recommendations,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to process statement", error: error.message });
  }
}
