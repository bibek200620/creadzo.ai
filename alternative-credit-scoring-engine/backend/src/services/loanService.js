function round2(value) {
  return Math.round(value * 100) / 100;
}

function roundInt(value) {
  return Math.round(value);
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getScoreTier(score = 0) {
  if (score >= 780) {
    return {
      tier: "PRIME",
      annualInterestRate: 14,
      maxMultiplier: 5,
      maxTenureMonths: 24,
      minScore: 780,
    };
  }

  if (score >= 680) {
    return {
      tier: "PREFERRED",
      annualInterestRate: 18,
      maxMultiplier: 4,
      maxTenureMonths: 18,
      minScore: 680,
    };
  }

  if (score >= 560) {
    return {
      tier: "STANDARD",
      annualInterestRate: 24,
      maxMultiplier: 3,
      maxTenureMonths: 12,
      minScore: 560,
    };
  }

  if (score >= 520) {
    return {
      tier: "STARTER",
      annualInterestRate: 30,
      maxMultiplier: 2,
      maxTenureMonths: 6,
      minScore: 520,
    };
  }

  return {
    tier: "INELIGIBLE",
    annualInterestRate: 36,
    maxMultiplier: 1,
    maxTenureMonths: 3,
    minScore: 520,
  };
}

export function calculateEmi(principal, annualInterestRate, tenureMonths) {
  const p = Number(principal || 0);
  const n = Number(tenureMonths || 0);
  const monthlyRate = annualInterestRate / 12 / 100;

  if (!p || !n || p <= 0 || n <= 0) {
    return {
      emi: 0,
      totalRepayable: 0,
      totalInterest: 0,
      monthlyInterestRate: monthlyRate,
    };
  }

  if (monthlyRate === 0) {
    const emi = p / n;
    const totalRepayable = emi * n;
    return {
      emi: round2(emi),
      totalRepayable: round2(totalRepayable),
      totalInterest: round2(totalRepayable - p),
      monthlyInterestRate: monthlyRate,
    };
  }

  const powered = (1 + monthlyRate) ** n;
  const emi = (p * monthlyRate * powered) / (powered - 1);
  const totalRepayable = emi * n;

  return {
    emi: round2(emi),
    totalRepayable: round2(totalRepayable),
    totalInterest: round2(totalRepayable - p),
    monthlyInterestRate: round2(monthlyRate),
  };
}

function calculateRepaymentCapacity(analytics = {}) {
  const metrics = analytics.metrics || {};
  const avgIncome = metrics.averageMonthlyIncome || 0;
  const avgExpense = metrics.averageMonthlyExpenses || 0;
  const monthlyCashflow = metrics.monthlyCashflow || avgIncome - avgExpense;

  const reserve = Math.max(0, monthlyCashflow) * 0.7;
  const incomeSupport = avgIncome * 0.2;

  return Math.max(2000, round2(reserve + incomeSupport));
}

function calculateMaxEligibleAmount(statement = {}) {
  const analytics = statement.analytics || {};
  const metrics = analytics.metrics || {};
  const trustScore = statement.score?.trustScore || 0;
  const tier = getScoreTier(trustScore);

  const avgIncome = metrics.averageMonthlyIncome || 0;
  const savingsRatio = metrics.savingsRatio || 0;
  const volatilityScore = metrics.volatilityScore || 0;

  let base = avgIncome * tier.maxMultiplier;

  if (savingsRatio >= 0.25) {
    base += avgIncome * 0.35;
  } else if (savingsRatio < 0.05) {
    base -= avgIncome * 0.25;
  }

  if (volatilityScore < 40) {
    base *= 0.82;
  }

  const floorAmount = Math.min(5000, Math.max(avgIncome * 0.5, 2500));
  const capped = Math.max(floorAmount, base);

  return roundInt(Math.max(0, Math.floor(capped / 500) * 500));
}

export function buildLoanOffers(statement) {
  const trustScore = statement?.score?.trustScore || 0;
  const scoreBand = statement?.score?.scoreBand || "Unknown";
  const analytics = statement?.analytics || {};
  const metrics = analytics.metrics || {};
  const tier = getScoreTier(trustScore);
  const maxEligibleAmount = calculateMaxEligibleAmount(statement);
  const repaymentCapacity = calculateRepaymentCapacity(analytics);

  if (tier.tier === "INELIGIBLE") {
    return {
      eligible: false,
      reason: "Trust score is below the minimum threshold for loan approval.",
      trustScore,
      scoreBand,
      tier: tier.tier,
      maxEligibleAmount: 0,
      maxTenureMonths: 0,
      annualInterestRate: tier.annualInterestRate,
      repaymentCapacity,
      recommendedOffers: [],
    };
  }

  const amounts = [0.4, 0.7, 1]
    .map((ratio) => roundInt(Math.max(5000, Math.floor((maxEligibleAmount * ratio) / 500) * 500)))
    .filter((value, index, arr) => value > 0 && arr.indexOf(value) === index)
    .sort((a, b) => a - b);

  const tenures = [
    Math.min(6, tier.maxTenureMonths),
    Math.min(12, tier.maxTenureMonths),
    tier.maxTenureMonths,
  ]
    .filter((value, index, arr) => value > 0 && arr.indexOf(value) === index)
    .sort((a, b) => a - b);

  const recommendedOffers = [];

  for (const amount of amounts) {
    for (const tenureMonths of tenures) {
      const estimate = calculateEmi(amount, tier.annualInterestRate, tenureMonths);
      recommendedOffers.push({
        amount,
        tenureMonths,
        annualInterestRate: tier.annualInterestRate,
        estimatedEmi: estimate.emi,
        totalRepayable: estimate.totalRepayable,
      });
    }
  }

  return {
    eligible: true,
    reason: "Eligible based on current trust score and statement behavior.",
    trustScore,
    scoreBand,
    tier: tier.tier,
    maxEligibleAmount,
    maxTenureMonths: tier.maxTenureMonths,
    annualInterestRate: tier.annualInterestRate,
    repaymentCapacity,
    averageMonthlyIncome: metrics.averageMonthlyIncome || 0,
    averageMonthlyExpenses: metrics.averageMonthlyExpenses || 0,
    recommendedOffers,
  };
}

export function evaluateLoanRequest(statement, requestedAmount, requestedTenureMonths) {
  const offer = buildLoanOffers(statement);
  const reasons = [];

  if (!offer.eligible) {
    reasons.push(offer.reason);
    return {
      decision: "REJECTED",
      reasons,
      offerSummary: offer,
      loanTerms: null,
    };
  }

  const amount = Number(requestedAmount || 0);
  const tenureMonths = Number(requestedTenureMonths || 0);

  if (!Number.isFinite(amount) || amount < 5000) {
    reasons.push("Requested amount must be at least ₹5,000.");
  }

  if (!Number.isFinite(tenureMonths) || tenureMonths < 3) {
    reasons.push("Tenure must be at least 3 months.");
  }

  if (amount > offer.maxEligibleAmount) {
    reasons.push(`Requested amount exceeds max eligible ₹${offer.maxEligibleAmount.toLocaleString()}.`);
  }

  if (tenureMonths > offer.maxTenureMonths) {
    reasons.push(`Requested tenure exceeds max eligible ${offer.maxTenureMonths} months.`);
  }

  const estimate = calculateEmi(amount, offer.annualInterestRate, tenureMonths);
  const affordabilityRatio = offer.repaymentCapacity > 0 ? estimate.emi / offer.repaymentCapacity : 99;

  if (affordabilityRatio > 0.9) {
    reasons.push("Estimated EMI exceeds safe repayment capacity for current cashflow.");
  }

  const savingsRatio = statement?.analytics?.metrics?.savingsRatio || 0;
  if (savingsRatio < 0 && amount > (statement?.analytics?.metrics?.averageMonthlyIncome || 0) * 1.5) {
    reasons.push("Negative savings trend with high requested amount.");
  }

  if (reasons.length > 0) {
    return {
      decision: "REJECTED",
      reasons,
      offerSummary: {
        ...offer,
        estimatedEmi: estimate.emi,
        requestedAmount: amount,
        requestedTenureMonths: tenureMonths,
      },
      loanTerms: null,
    };
  }

  return {
    decision: "APPROVED",
    reasons: ["Loan approved based on trust score, affordability, and behavior signals."],
    offerSummary: {
      ...offer,
      estimatedEmi: estimate.emi,
      requestedAmount: amount,
      requestedTenureMonths: tenureMonths,
      affordabilityRatio: round2(affordabilityRatio),
    },
    loanTerms: {
      amount,
      tenureMonths,
      annualInterestRate: offer.annualInterestRate,
      monthlyInterestRate: estimate.monthlyInterestRate,
      emi: estimate.emi,
      totalRepayable: estimate.totalRepayable,
      totalInterest: estimate.totalInterest,
    },
  };
}

export function buildRepaymentSchedule({ principal, annualInterestRate, tenureMonths, startDate = new Date() }) {
  const amount = Number(principal || 0);
  const n = Number(tenureMonths || 0);

  const { emi } = calculateEmi(amount, annualInterestRate, n);
  const monthlyRate = annualInterestRate / 12 / 100;

  let remainingPrincipal = amount;
  const schedule = [];

  for (let month = 1; month <= n; month += 1) {
    const interestComponent = monthlyRate === 0 ? 0 : remainingPrincipal * monthlyRate;
    let principalComponent = emi - interestComponent;

    if (month === n) {
      principalComponent = remainingPrincipal;
    }

    remainingPrincipal = Math.max(0, remainingPrincipal - principalComponent);

    schedule.push({
      installmentNumber: month,
      dueDate: addMonths(startDate, month),
      emiAmount: round2(emi),
      principalComponent: round2(principalComponent),
      interestComponent: round2(interestComponent),
      paidAmount: 0,
      paidAt: null,
      status: "PENDING",
    });
  }

  return schedule;
}

export function getNextPendingDueDate(schedule = []) {
  const next = schedule.find((item) => item.status === "PENDING");
  return next ? next.dueDate : null;
}
