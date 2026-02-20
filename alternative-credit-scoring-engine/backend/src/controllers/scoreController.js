import Statement from "../models/Statement.js";
import mongoose from "mongoose";

export async function generateScore(req, res) {
  try {
    const latestStatement = await Statement.findOne({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestStatement) {
      return res.status(404).json({ message: "No statement analysis found. Upload a statement first." });
    }

    return res.status(200).json({
      statementId: latestStatement._id,
      generatedAt: latestStatement.createdAt,
      trustScore: latestStatement.score.trustScore,
      scoreBand: latestStatement.score.scoreBand,
      summary: latestStatement.score.summary,
      modelVersion: latestStatement.score.modelVersion,
      behavioralAdjustment: latestStatement.score.behavioralAdjustment,
      componentBreakdown: latestStatement.score.componentBreakdown,
      keyMetrics: {
        incomeStabilityScore: latestStatement.analytics.metrics.incomeStabilityScore,
        spendingDisciplineScore: latestStatement.analytics.metrics.spendingDisciplineScore,
        emiConsistencyScore: latestStatement.analytics.metrics.emiConsistencyScore,
        savingsRatioScore: latestStatement.analytics.metrics.savingsRatioScore,
        utilityBillTimelinessScore: latestStatement.analytics.metrics.utilityBillTimelinessScore,
        minimumBalanceScore: latestStatement.analytics.metrics.minimumBalanceScore,
      },
      recommendations: latestStatement.recommendations || null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate score", error: error.message });
  }
}

function toCsvValue(value) {
  const stringValue = String(value ?? "");
  const escaped = stringValue.replace(/\"/g, "\"\"");
  return `"${escaped}"`;
}

export async function exportScoreReport(req, res) {
  try {
    const format = String(req.query.format || "json").toLowerCase();
    const statementId = req.params.statementId || null;

    if (statementId && !mongoose.isValidObjectId(statementId)) {
      return res.status(400).json({ message: "Invalid statement id" });
    }

    let query = { user: req.user._id };
    if (statementId) {
      query = { ...query, _id: statementId };
    }

    const statement = await Statement.findOne(query)
      .sort(statementId ? {} : { createdAt: -1 })
      .lean();

    if (!statement) {
      return res.status(404).json({ message: "Statement report not found" });
    }

    const report = {
      statementId: statement._id,
      fileName: statement.fileName,
      uploadedAt: statement.createdAt,
      trustScore: statement.score?.trustScore || 0,
      scoreBand: statement.score?.scoreBand || "Unknown",
      summary: statement.score?.summary || "",
      modelVersion: statement.score?.modelVersion || "v1-rule-behavioral",
      metrics: statement.analytics?.metrics || {},
      componentBreakdown: statement.score?.componentBreakdown || [],
      recommendations: statement.recommendations?.recommendations || [],
      riskFlags: statement.recommendations?.riskFlags || [],
    };

    if (format === "csv") {
      const metrics = report.metrics;
      const componentLines = report.componentBreakdown.map((component) => {
        return [
          report.statementId,
          report.fileName,
          report.uploadedAt,
          report.trustScore,
          report.scoreBand,
          component.name,
          component.rawScore,
          component.weightPercent,
          component.contributionToModel,
          metrics.averageMonthlyIncome || 0,
          metrics.averageMonthlyExpenses || 0,
          metrics.savingsRatio || 0,
          metrics.incomeStabilityScore || 0,
          metrics.spendingDisciplineScore || 0,
          metrics.emiConsistencyScore || 0,
          metrics.utilityBillTimelinessScore || 0,
          metrics.minimumBalanceScore || 0,
        ]
          .map(toCsvValue)
          .join(",");
      });

      const header = [
        "statementId",
        "fileName",
        "uploadedAt",
        "trustScore",
        "scoreBand",
        "component",
        "rawScore",
        "weightPercent",
        "contributionToModel",
        "averageMonthlyIncome",
        "averageMonthlyExpenses",
        "savingsRatio",
        "incomeStabilityScore",
        "spendingDisciplineScore",
        "emiConsistencyScore",
        "utilityBillTimelinessScore",
        "minimumBalanceScore",
      ]
        .map(toCsvValue)
        .join(",");

      const csvContent = [header, ...componentLines].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"score-report-${report.statementId}.csv\"`);
      return res.status(200).send(csvContent);
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"score-report-${report.statementId}.json\"`);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ message: "Failed to export score report", error: error.message });
  }
}
