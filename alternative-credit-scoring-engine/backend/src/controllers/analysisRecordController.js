import AnalysisRecord from "../models/AnalysisRecord.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function getRetentionDays() {
  const value = Number(process.env.ANALYSIS_RETENTION_DAYS || 15);
  if (!Number.isFinite(value) || value < 1 || value > 90) {
    return 15;
  }
  return Math.floor(value);
}

function extractSummary(analysis) {
  const scoreOverview = analysis?.scoreOverview || {};
  const creditLimitBreakdown = analysis?.creditLimitBreakdown || {};

  const approvedLimit = Number(
    creditLimitBreakdown?.approvedLimit ?? analysis?.recommendedCreditLimit ?? 0
  );

  return {
    trustScore: Number(scoreOverview?.trustScore || 0),
    trustLevel: String(scoreOverview?.trustLevel || ""),
    scorePercentile: Number(analysis?.scorePercentile || 0),
    approvedLimit: Number.isFinite(approvedLimit) ? approvedLimit : 0,
    repaymentCapacity: Number(creditLimitBreakdown?.repaymentCapacity || 0),
  };
}

function mapAnalysisRecord(record, includePayload = true) {
  return {
    id: String(record._id),
    sourceFileName: record.sourceFileName || "",
    analyzedAt: record.analyzedAt,
    expiresAt: record.expiresAt,
    summary: record.summary || null,
    analysis: includePayload ? record.analysisPayload : undefined,
  };
}

export async function saveAnalysisRecord(req, res) {
  try {
    const analysis = req.body?.analysis;
    const sourceFileName = String(req.body?.sourceFileName || "").trim();

    if (!analysis || typeof analysis !== "object") {
      return res.status(400).json({ message: "Valid analysis payload is required" });
    }

    const analyzedAt = new Date();
    const expiresAt = new Date(analyzedAt.getTime() + getRetentionDays() * DAY_MS);
    const summary = extractSummary(analysis);

    const created = await AnalysisRecord.create({
      user: req.user._id,
      sourceFileName,
      summary,
      analysisPayload: analysis,
      analyzedAt,
      expiresAt,
    });

    return res.status(201).json({
      message: "Analysis saved successfully",
      record: mapAnalysisRecord(created),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save analysis", error: error.message });
  }
}

export async function getLatestAnalysisRecord(req, res) {
  try {
    const now = new Date();
    const latest = await AnalysisRecord.findOne({
      user: req.user._id,
      expiresAt: { $gt: now },
    })
      .sort({ analyzedAt: -1 })
      .lean();

    if (!latest) {
      return res.status(404).json({
        message: "No active analysis record found. Upload and analyze a statement first.",
      });
    }

    return res.status(200).json({
      record: mapAnalysisRecord(latest),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch latest analysis", error: error.message });
  }
}

export async function getAnalysisRecordHistory(req, res) {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));

    const records = await AnalysisRecord.find({ user: req.user._id })
      .sort({ analyzedAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      count: records.length,
      records: records.map((item) => mapAnalysisRecord(item, false)),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch analysis history", error: error.message });
  }
}
