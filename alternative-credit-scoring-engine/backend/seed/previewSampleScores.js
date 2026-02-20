import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseUploadedStatement } from "../src/services/parserService.js";
import { computeAnalytics } from "../src/services/analyticsService.js";
import { generateTrustScore } from "../src/services/scoringService.js";
import { generateRecommendations } from "../src/services/recommendationService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const samples = [
  "gig_worker.csv",
  "salaried_emi.csv",
  "volatile_cashflow.csv",
];

async function previewScores() {
  const results = [];

  for (const sample of samples) {
    const samplePath = path.join(__dirname, "..", "demo", "statements", sample);
    const buffer = fs.readFileSync(samplePath);

    const parsed = await parseUploadedStatement({
      originalname: sample,
      buffer,
    });

    const analytics = computeAnalytics(parsed.transactions);
    const score = generateTrustScore(analytics);
    const recommendations = generateRecommendations(analytics, score);

    results.push({
      sample,
      trustScore: score.trustScore,
      scoreBand: score.scoreBand,
      avgIncome: analytics.metrics.averageMonthlyIncome,
      avgExpenses: analytics.metrics.averageMonthlyExpenses,
      missedEmiIndicators: analytics.metrics.missedEmiIndicators,
      savingsRatio: analytics.metrics.savingsRatio,
      topRecommendation: recommendations.recommendations[0]?.title || \"--\",
    });
  }

  console.table(results);
}

previewScores().catch((error) => {
  console.error(error);
  process.exit(1);
});
