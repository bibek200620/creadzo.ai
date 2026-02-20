import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import Statement from "../src/models/Statement.js";
import { parseUploadedStatement } from "../src/services/parserService.js";
import { computeAnalytics } from "../src/services/analyticsService.js";
import { generateTrustScore } from "../src/services/scoringService.js";
import { generateRecommendations } from "../src/services/recommendationService.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const demoDir = path.join(__dirname, "..", "demo");

async function seedDemoData() {
  await connectDB();

  const usersJsonPath = path.join(demoDir, "sample-users.json");
  const usersData = JSON.parse(fs.readFileSync(usersJsonPath, "utf8"));

  const results = [];

  for (const profile of usersData) {
    const existingUser = await User.findOne({ email: profile.email });

    if (existingUser) {
      await Statement.deleteMany({ user: existingUser._id });
      await User.deleteOne({ _id: existingUser._id });
    }

    const hashedPassword = await bcrypt.hash(profile.password, 12);

    const user = await User.create({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      password: hashedPassword,
    });

    const statementPath = path.join(demoDir, "statements", profile.statementFile);
    const buffer = fs.readFileSync(statementPath);

    const parsed = await parseUploadedStatement({
      originalname: profile.statementFile,
      buffer,
    });

    const analytics = computeAnalytics(parsed.transactions);
    const score = generateTrustScore(analytics);
    const recommendations = generateRecommendations(analytics, score);

    await Statement.create({
      user: user._id,
      fileName: profile.statementFile,
      fileType: parsed.fileType,
      transactions: parsed.transactions,
      analytics,
      score,
      recommendations,
    });

    results.push({
      email: profile.email,
      trustScore: score.trustScore,
      scoreBand: score.scoreBand,
      avgMonthlyIncome: analytics.metrics.averageMonthlyIncome,
      avgMonthlyExpenses: analytics.metrics.averageMonthlyExpenses,
      savingsRatio: analytics.metrics.savingsRatio,
    });
  }

  console.table(results);
}

seedDemoData()
  .then(async () => {
    await mongoose.disconnect();
    console.log("Demo data seeded successfully");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Failed to seed demo data", error);
    await mongoose.disconnect();
    process.exit(1);
  });
