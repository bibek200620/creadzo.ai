function pushRecommendation(list, recommendation) {
  const exists = list.some((item) => item.code === recommendation.code);
  if (!exists) {
    list.push(recommendation);
  }
}

export function generateRecommendations(analytics, score) {
  const metrics = analytics?.metrics || {};
  const recommendations = [];

  if ((metrics.incomeStabilityScore || 0) < 70) {
    pushRecommendation(recommendations, {
      code: "income_stability",
      title: "Improve income regularity",
      priority: "high",
      potentialScoreImpact: "+40 to +90",
      reason: "Income flow is volatile across months.",
      action: "Route major inflows through one account and maintain consistent weekly or monthly credits.",
    });
  }

  if ((metrics.savingsRatio || 0) < 0.12) {
    pushRecommendation(recommendations, {
      code: "savings_ratio",
      title: "Increase monthly savings ratio",
      priority: "high",
      potentialScoreImpact: "+35 to +80",
      reason: "Savings ratio is below healthy threshold.",
      action: "Set an automatic transfer of at least 10-15% of income into a savings bucket.",
    });
  }

  if ((metrics.emiConsistencyScore || 0) < 75 || (metrics.missedEmiIndicators || 0) > 0) {
    pushRecommendation(recommendations, {
      code: "emi_consistency",
      title: "Stabilize EMI repayment behavior",
      priority: "high",
      potentialScoreImpact: "+30 to +100",
      reason: "EMI consistency signals indicate missed or risky repayment behavior.",
      action: "Keep EMI due amount in account 48 hours before due date and avoid balance drops around due dates.",
    });
  }

  if ((metrics.utilityBillTimelinessScore || 0) < 70) {
    pushRecommendation(recommendations, {
      code: "utility_timeliness",
      title: "Pay utility bills on a fixed schedule",
      priority: "medium",
      potentialScoreImpact: "+20 to +55",
      reason: "Utility payment pattern is inconsistent.",
      action: "Use autopay for electricity/water/gas/recharge to establish consistent payment dates.",
    });
  }

  if ((metrics.minimumBalanceScore || 0) < 65) {
    pushRecommendation(recommendations, {
      code: "balance_stability",
      title: "Maintain minimum balance cushion",
      priority: "high",
      potentialScoreImpact: "+35 to +75",
      reason: "Minimum balance behavior shows stress periods.",
      action: "Maintain a reserve equal to at least 1.0x of essential monthly outflows.",
    });
  }

  if ((metrics.spendingDisciplineScore || 0) < 65) {
    pushRecommendation(recommendations, {
      code: "spending_discipline",
      title: "Reduce discretionary spending volatility",
      priority: "medium",
      potentialScoreImpact: "+20 to +60",
      reason: "Discretionary debit share is high.",
      action: "Cap shopping/food/entertainment spend with weekly limits and lower cash withdrawals.",
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      code: "maintain_profile",
      title: "Maintain current healthy profile",
      priority: "low",
      potentialScoreImpact: "+10 to +25",
      reason: "Your current patterns are healthy and stable.",
      action: "Continue consistent inflows, timely bills, and avoid sudden high outflows.",
    });
  }

  const riskFlags = [];
  if ((metrics.missedEmiIndicators || 0) > 0) {
    riskFlags.push("Missed or bounced EMI indicators detected");
  }
  if ((metrics.volatilityScore || 0) < 40) {
    riskFlags.push("High cashflow volatility");
  }
  if ((metrics.minimumBalanceScore || 0) < 55) {
    riskFlags.push("Low minimum balance stability");
  }
  if ((score?.trustScore || 0) < 500) {
    riskFlags.push("Low trust score band");
  }

  return {
    generatedAt: new Date().toISOString(),
    recommendations,
    riskFlags,
    nextReviewWindowDays: 30,
  };
}
