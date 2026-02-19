import { roundCurrency } from "@/lib/server/api";

export type LoanTier = "INELIGIBLE" | "STANDARD" | "PREFERRED" | "PRIME";

export type LoanPolicy = {
  eligible: boolean;
  tier: LoanTier;
  maxTenure: number;
  monthlyRate: number;
  limitFactor: number;
  reason: string;
};

export type InstallmentRecord = {
  installmentNumber: number;
  dueDateMs: number;
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  paidAmount: number;
  status: "PENDING" | "PAID";
  paidAtMs: number | null;
};

export function getLoanPolicy(score: number | null): LoanPolicy {
  if (score === null) {
    return {
      eligible: false,
      tier: "INELIGIBLE",
      maxTenure: 0,
      monthlyRate: 0,
      limitFactor: 0,
      reason: "Complete credit analysis to generate your Trust Score first.",
    };
  }

  if (score < 600) {
    return {
      eligible: false,
      tier: "INELIGIBLE",
      maxTenure: 0,
      monthlyRate: 0,
      limitFactor: 0,
      reason: "Loan approval starts at Trust Score 600.",
    };
  }

  if (score < 700) {
    return {
      eligible: true,
      tier: "STANDARD",
      maxTenure: 6,
      monthlyRate: 0.018,
      limitFactor: 0.65,
      reason: "Score-qualified under Standard tier.",
    };
  }

  if (score < 800) {
    return {
      eligible: true,
      tier: "PREFERRED",
      maxTenure: 9,
      monthlyRate: 0.015,
      limitFactor: 0.85,
      reason: "Score-qualified under Preferred tier.",
    };
  }

  return {
    eligible: true,
    tier: "PRIME",
    maxTenure: 12,
    monthlyRate: 0.013,
    limitFactor: 1,
    reason: "Score-qualified under Prime tier.",
  };
}

export function getScoreBasedMaxLimit(analysisLimit: number, limitFactor: number): number {
  const baseLimit = Math.max(0, Number(analysisLimit || 0));
  if (baseLimit < 1000) return 0;
  const scaled = Math.floor((baseLimit * limitFactor) / 500) * 500;
  return Math.max(1000, scaled);
}

export function calculateEmi(amount: number, monthlyRate: number, tenureMonths: number): number {
  if (amount <= 0 || tenureMonths <= 0) return 0;
  if (monthlyRate <= 0) return roundCurrency(amount / tenureMonths);

  const pow = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (amount * monthlyRate * pow) / (pow - 1);
  return roundCurrency(emi);
}

function addMonths(timestampMs: number, months: number): number {
  const date = new Date(timestampMs);
  date.setMonth(date.getMonth() + months);
  return date.getTime();
}

export function buildInstallmentSchedule(
  principal: number,
  monthlyRate: number,
  tenureMonths: number,
  startTimestampMs: number,
): InstallmentRecord[] {
  const emi = calculateEmi(principal, monthlyRate, tenureMonths);
  let balance = principal;
  const installments: InstallmentRecord[] = [];

  for (let month = 1; month <= tenureMonths; month += 1) {
    const interest = roundCurrency(balance * monthlyRate);
    let principalComponent = roundCurrency(emi - interest);

    // Settle any residual in the final installment.
    if (month === tenureMonths) {
      principalComponent = roundCurrency(balance);
    }

    balance = roundCurrency(Math.max(0, balance - principalComponent));

    installments.push({
      installmentNumber: month,
      dueDateMs: addMonths(startTimestampMs, month),
      emiAmount: emi,
      principalComponent,
      interestComponent: interest,
      paidAmount: 0,
      status: "PENDING",
      paidAtMs: null,
    });
  }

  return installments;
}
