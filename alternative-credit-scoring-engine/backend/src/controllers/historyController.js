import mongoose from "mongoose";
import Statement from "../models/Statement.js";

export async function getStatementHistory(req, res) {
  try {
    const limitRaw = Number(req.query.limit || 12);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 50)) : 12;

    const statements = await Statement.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const history = statements.map((item) => ({
      id: item._id,
      fileName: item.fileName,
      fileType: item.fileType,
      uploadedAt: item.createdAt,
      trustScore: item.score?.trustScore || 0,
      scoreBand: item.score?.scoreBand || "Unknown",
      averageMonthlyIncome: item.analytics?.metrics?.averageMonthlyIncome || 0,
      averageMonthlyExpenses: item.analytics?.metrics?.averageMonthlyExpenses || 0,
      savingsRatio: item.analytics?.metrics?.savingsRatio || 0,
      monthsAnalysed: item.analytics?.detectedSignals?.monthsAnalysed || 0,
      statementSummary: item.score?.summary || "",
    }));

    return res.status(200).json({
      count: history.length,
      history,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch statement history", error: error.message });
  }
}

export async function getStatementHistoryItem(req, res) {
  try {
    const { statementId } = req.params;

    if (!mongoose.isValidObjectId(statementId)) {
      return res.status(400).json({ message: "Invalid statement id" });
    }

    const statement = await Statement.findOne({
      _id: statementId,
      user: req.user._id,
    }).lean();

    if (!statement) {
      return res.status(404).json({ message: "Statement not found" });
    }

    return res.status(200).json({
      statement: {
        id: statement._id,
        fileName: statement.fileName,
        fileType: statement.fileType,
        uploadedAt: statement.createdAt,
      },
      analytics: statement.analytics,
      score: statement.score,
      recommendations: statement.recommendations || null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch statement details", error: error.message });
  }
}
