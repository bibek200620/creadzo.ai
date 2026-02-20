function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function stdDev(values) {
  if (!values.length) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function getMonthKey(date) {
  return new Date(date).toISOString().slice(0, 7);
}

function buildMonthlySeries(transactions) {
  const monthlyMap = new Map();

  for (const tx of transactions) {
    const month = getMonthKey(tx.date);
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        month,
        income: 0,
        expenses: 0,
        netCashflow: 0,
        transactionCount: 0,
      });
    }

    const bucket = monthlyMap.get(month);
    if (tx.type === "credit") {
      bucket.income += tx.amount;
    } else {
      bucket.expenses += tx.amount;
    }

    bucket.netCashflow = bucket.income - bucket.expenses;
    bucket.transactionCount += 1;
  }

  return Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((month) => ({
      ...month,
      income: round2(month.income),
      expenses: round2(month.expenses),
      netCashflow: round2(month.netCashflow),
    }));
}

function buildCategorySpending(transactions) {
  const categoryMap = new Map();
  const debits = transactions.filter((tx) => tx.type === "debit");
  const totalDebits = debits.reduce((sum, tx) => sum + tx.amount, 0);

  for (const tx of debits) {
    const current = categoryMap.get(tx.category) || 0;
    categoryMap.set(tx.category, current + tx.amount);
  }

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      percentage: totalDebits > 0 ? round2((amount / totalDebits) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function buildTransactionTrend(transactions) {
  let runningBalance = transactions.find((tx) => typeof tx.balance === "number")?.balance || 0;

  return transactions.slice(0, 180).map((tx) => {
    if (typeof tx.balance === "number") {
      runningBalance = tx.balance;
    } else {
      runningBalance += tx.type === "credit" ? tx.amount : -tx.amount;
    }

    return {
      date: new Date(tx.date).toISOString().slice(0, 10),
      balance: round2(runningBalance),
      flow: round2(tx.type === "credit" ? tx.amount : -tx.amount),
    };
  });
}

function calculateSavingsRatioScore(ratio) {
  if (ratio >= 0.35) return 95;
  if (ratio >= 0.25) return 85;
  if (ratio >= 0.15) return 72;
  if (ratio >= 0.05) return 60;
  if (ratio >= 0) return 45;
  return 20;
}

function calculateIncomeStabilityScore(monthlySeries, salaryCreditsPerMonth) {
  const incomeSeries = monthlySeries.map((m) => m.income).filter((v) => v > 0);
  if (!incomeSeries.length) return 20;
  if (incomeSeries.length === 1) return 60;

  const avg = incomeSeries.reduce((a, b) => a + b, 0) / incomeSeries.length;
  const volatility = stdDev(incomeSeries) / (avg || 1);
  let score = 100 - volatility * 120;

  if (salaryCreditsPerMonth >= 2) {
    score += 8;
  }

  return clamp(Math.round(score));
}

function calculateVolatilityScore(monthlySeries) {
  if (!monthlySeries.length) return 20;

  const netSeries = monthlySeries.map((m) => Math.abs(m.netCashflow));
  const avg = netSeries.reduce((a, b) => a + b, 0) / netSeries.length;
  const vol = stdDev(netSeries) / (avg || 1);
  return clamp(Math.round(100 - vol * 100));
}

function calculateMinimumBalanceScore(transactions, avgMonthlyIncome, avgMonthlyExpenses) {
  const balances = transactions
    .map((tx) => tx.balance)
    .filter((balance) => typeof balance === "number");

  if (!balances.length) return 55;

  const minBalance = Math.min(...balances);
  const avgBalance = balances.reduce((a, b) => a + b, 0) / balances.length;
  const referenceIncome = avgMonthlyIncome || 1;

  let score = (minBalance / referenceIncome) * 120;

  if (minBalance < 0) score -= 25;
  if (avgBalance > avgMonthlyExpenses * 0.5) score += 10;

  return clamp(Math.round(score));
}

function calculateEmiConsistencyScore(emiTransactions, monthsAnalysed, transactions) {
  if (!emiTransactions.length) {
    return {
      score: 65,
      missedIndicators: 0,
      bouncedIndicators: 0,
    };
  }

  const emiMonths = new Set(emiTransactions.map((tx) => getMonthKey(tx.date)));
  const bouncedIndicators = transactions.filter((tx) => {
    const text = tx.description.toUpperCase();
    return text.includes("BOUNCE") || text.includes("RETURN") || text.includes("PENALTY");
  }).length;

  const missedMonths = Math.max(monthsAnalysed - emiMonths.size, 0);
  let score = 100 - missedMonths * 18 - bouncedIndicators * 22;

  if (missedMonths === 0) {
    score += 5;
  }

  return {
    score: clamp(Math.round(score)),
    missedIndicators: missedMonths,
    bouncedIndicators,
  };
}

function calculateUtilityTimelinessScore(utilityTransactions, monthsAnalysed) {
  if (!utilityTransactions.length) return 55;

  const utilityMonths = new Set(utilityTransactions.map((tx) => getMonthKey(tx.date)));
  const coverageScore = (utilityMonths.size / Math.max(monthsAnalysed, 1)) * 100;

  const days = utilityTransactions.map((tx) => new Date(tx.date).getDate());
  const dayStdDev = stdDev(days);
  const consistencyScore = clamp(100 - dayStdDev * 8);

  return clamp(Math.round(coverageScore * 0.7 + consistencyScore * 0.3));
}

function calculateSpendingDisciplineScore(categorySpending, totalExpenses, savingsRatio, avgMonthlyExpenses, transactions) {
  if (!totalExpenses) return 70;

  const discretionaryCategories = new Set(["Food", "Shopping", "Entertainment", "Transport", "Cash Withdrawal"]);

  const discretionarySpend = categorySpending
    .filter((category) => discretionaryCategories.has(category.category))
    .reduce((sum, category) => sum + category.amount, 0);

  const discretionaryRatio = discretionarySpend / totalExpenses;
  let score = 100 - discretionaryRatio * 100;

  const highDebitCount = transactions.filter(
    (tx) => tx.type === "debit" && tx.amount > avgMonthlyExpenses * 0.4
  ).length;

  score -= Math.min(highDebitCount * 3, 20);

  if (savingsRatio >= 0.2) {
    score += 8;
  }

  return clamp(Math.round(score));
}

export function computeAnalytics(transactions) {
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!sorted.length) {
    return {
      monthlySeries: [],
      categorySpending: [],
      transactionTrend: [],
      totals: {
        totalIncome: 0,
        totalExpenses: 0,
        netCashflow: 0,
      },
      metrics: {
        averageMonthlyIncome: 0,
        averageMonthlyExpenses: 0,
        monthlyCashflow: 0,
        savingsRatio: 0,
        incomeStabilityScore: 0,
        volatilityScore: 0,
        savingsRatioScore: 0,
        minimumBalanceScore: 0,
        emiConsistencyScore: 0,
        utilityBillTimelinessScore: 0,
        spendingDisciplineScore: 0,
        cashflowHealthScore: 0,
        transactionStabilityScore: 0,
        missedEmiIndicators: 0,
      },
      detectedSignals: {
        salaryCredits: 0,
        emiTransactions: 0,
        utilityTransactions: 0,
        monthsAnalysed: 0,
      },
    };
  }

  const monthlySeries = buildMonthlySeries(sorted);
  const categorySpending = buildCategorySpending(sorted);
  const transactionTrend = buildTransactionTrend(sorted);

  const totalIncome = round2(
    sorted.filter((tx) => tx.type === "credit").reduce((sum, tx) => sum + tx.amount, 0)
  );
  const totalExpenses = round2(
    sorted.filter((tx) => tx.type === "debit").reduce((sum, tx) => sum + tx.amount, 0)
  );

  const monthsAnalysed = Math.max(monthlySeries.length, 1);
  const averageMonthlyIncome = round2(totalIncome / monthsAnalysed);
  const averageMonthlyExpenses = round2(totalExpenses / monthsAnalysed);
  const monthlyCashflow = round2(averageMonthlyIncome - averageMonthlyExpenses);
  const savingsRatio = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0;

  const salaryCredits = sorted.filter((tx) => tx.flags?.isSalary).length;
  const salaryCreditMonths = new Set(
    sorted.filter((tx) => tx.flags?.isSalary).map((tx) => getMonthKey(tx.date))
  ).size;

  const utilityTransactions = sorted.filter((tx) => tx.flags?.isUtility || tx.category === "Rent");
  const emiTransactions = sorted.filter((tx) => tx.flags?.isEmi && tx.type === "debit");

  const incomeStabilityScore = calculateIncomeStabilityScore(monthlySeries, salaryCreditMonths);
  const volatilityScore = calculateVolatilityScore(monthlySeries);
  const savingsRatioScore = calculateSavingsRatioScore(savingsRatio);
  const minimumBalanceScore = calculateMinimumBalanceScore(sorted, averageMonthlyIncome, averageMonthlyExpenses);
  const emiScoreInfo = calculateEmiConsistencyScore(emiTransactions, monthsAnalysed, sorted);
  const utilityBillTimelinessScore = calculateUtilityTimelinessScore(utilityTransactions, monthsAnalysed);
  const spendingDisciplineScore = calculateSpendingDisciplineScore(
    categorySpending,
    totalExpenses,
    savingsRatio,
    averageMonthlyExpenses,
    sorted
  );

  const positiveCashflowMonths = monthlySeries.filter((month) => month.netCashflow >= 0).length;
  const cashflowHealthScore = clamp(Math.round((positiveCashflowMonths / monthsAnalysed) * 100));
  const transactionStabilityScore = clamp(
    Math.round((incomeStabilityScore * 0.55) + (volatilityScore * 0.45))
  );

  return {
    monthlySeries,
    categorySpending,
    transactionTrend,
    totals: {
      totalIncome,
      totalExpenses,
      netCashflow: round2(totalIncome - totalExpenses),
    },
    metrics: {
      averageMonthlyIncome,
      averageMonthlyExpenses,
      monthlyCashflow,
      savingsRatio: round2(savingsRatio),
      incomeStabilityScore,
      volatilityScore,
      savingsRatioScore,
      minimumBalanceScore,
      emiConsistencyScore: emiScoreInfo.score,
      utilityBillTimelinessScore,
      spendingDisciplineScore,
      cashflowHealthScore,
      transactionStabilityScore,
      missedEmiIndicators: emiScoreInfo.missedIndicators + emiScoreInfo.bouncedIndicators,
    },
    detectedSignals: {
      salaryCredits,
      emiTransactions: emiTransactions.length,
      utilityTransactions: utilityTransactions.length,
      monthsAnalysed,
    },
  };
}
