function clamp(value, min = 0, max = 900) {
  return Math.max(min, Math.min(max, value));
}

function getScoreBand(score) {
  if (score >= 780) return "Excellent";
  if (score >= 680) return "Good";
  if (score >= 560) return "Moderate";
  if (score >= 420) return "Watchlist";
  return "High Risk";
}

export function generateTrustScore(analytics) {
  const metrics = analytics.metrics;

  const components = [
    {
      name: "Income Regularity",
      score: metrics.incomeStabilityScore,
      weight: 0.22,
      description: "Consistency of recurring income across months",
    },
    {
      name: "Spending Pattern",
      score: metrics.spendingDisciplineScore,
      weight: 0.18,
      description: "Discretionary spending vs total outflow",
    },
    {
      name: "Missed EMI Indicators",
      score: metrics.emiConsistencyScore,
      weight: 0.16,
      description: "EMI consistency and penalty/bounce indicators",
    },
    {
      name: "Savings Ratio",
      score: metrics.savingsRatioScore,
      weight: 0.16,
      description: "Ability to retain surplus after expenses",
    },
    {
      name: "Utility Bill Timeliness",
      score: metrics.utilityBillTimelinessScore,
      weight: 0.12,
      description: "Regularity of utility and rent-type payments",
    },
    {
      name: "Account Balance Stability",
      score: metrics.minimumBalanceScore,
      weight: 0.16,
      description: "Minimum balance and account cushion behavior",
    },
  ];

  const weightedBase = components.reduce((sum, component) => {
    return sum + component.score * component.weight;
  }, 0);

  const behaviorAdjustment =
    ((metrics.cashflowHealthScore - 50) * 0.08) +
    ((metrics.transactionStabilityScore - 50) * 0.05) -
    ((metrics.volatilityScore < 35 ? 10 : 0));

  const normalizedScore = Math.max(0, Math.min(100, weightedBase + behaviorAdjustment));
  const trustScore = clamp(Math.round(normalizedScore * 9), 0, 900);
  const band = getScoreBand(trustScore);

  const totalContribution = components.reduce((sum, component) => {
    return sum + component.score * component.weight;
  }, 0) || 1;

  const componentBreakdown = components.map((component) => {
    const weightedContribution = component.score * component.weight;
    return {
      name: component.name,
      rawScore: Math.round(component.score),
      weightPercent: Math.round(component.weight * 100),
      contributionToModel: Number((weightedContribution / totalContribution * 100).toFixed(2)),
      weightedContribution: Number(weightedContribution.toFixed(2)),
      description: component.description,
    };
  });

  const summary = trustScore >= 680
    ? "Strong behavior profile with healthy cashflow signals."
    : trustScore >= 560
      ? "Stable profile with moderate risk and room for score improvement."
      : "Score indicates elevated risk; improve savings and bill/EMI discipline.";

  return {
    trustScore,
    scoreBand: band,
    modelVersion: "v1-rule-behavioral",
    summary,
    behavioralAdjustment: Number(behaviorAdjustment.toFixed(2)),
    componentBreakdown,
  };
}
