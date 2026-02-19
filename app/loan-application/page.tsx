"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { backendRequest, getToken } from "@/lib/backendClient";

type LoanPolicy = {
  eligible: boolean;
  tier: "INELIGIBLE" | "STANDARD" | "PREFERRED" | "PRIME";
  maxTenure: number;
  monthlyRate: number;
  limitFactor: number;
  reason: string;
};

type LatestLoan = {
  id: string;
  requestedAmount: number;
  approvedAmount: number;
  tenureMonths: number;
  monthlyRate: number;
  annualRate: number;
  emi: number;
  totalPayable: number;
  paidAmount: number;
  remainingAmount: number;
  trustScore: number;
  approvedLimit: number;
  policyTier: string;
  policyReason: string;
  status: "ACTIVE" | "CLOSED" | "PENDING" | "REJECTED";
  nextDueDate: string | null;
  createdAt: string | null;
};

type LatestLoanResponse = {
  loan: LatestLoan;
};

function getLoanPolicy(score: number | null): LoanPolicy {
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
      reason: "Loan approval starts at Trust Score 600. Improve score through consistent transactions.",
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

export default function LoanApplicationPage() {
  const router = useRouter();
  const [amount, setAmount] = useState(5000);
  const [tenure, setTenure] = useState(3);
  const [emi, setEmi] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);
  const [analysisLimit, setAnalysisLimit] = useState(0);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [activeLoan, setActiveLoan] = useState<LatestLoan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [isRepaying, setIsRepaying] = useState(false);
  const [repayAmount, setRepayAmount] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const policy = useMemo(() => getLoanPolicy(trustScore), [trustScore]);

  const maxLimit = useMemo(() => {
    if (!policy.eligible || analysisLimit < 1000) return 0;
    const scaled = Math.floor((analysisLimit * policy.limitFactor) / 500) * 500;
    return Math.max(1000, scaled);
  }, [analysisLimit, policy.eligible, policy.limitFactor]);

  const canApply = policy.eligible && maxLimit >= 1000;
  const minAmount = canApply ? 1000 : 0;
  const amountStep = 500;
  const maxTenure = canApply ? policy.maxTenure : 12;

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/onboarding/sign-in");
      return;
    }

    let cancelled = false;

    const hydrateFallbackLocal = () => {
      const stored = localStorage.getItem("credzoAnalysis");
      if (!stored) return;
      try {
        const data = JSON.parse(stored) as { creditLimit?: number; trustScore?: number };
        const fallbackLimit = Number(data?.creditLimit || 0);
        const fallbackScore = typeof data?.trustScore === "number" ? data.trustScore : null;

        if (fallbackLimit > 0 || fallbackScore !== null) setHasAnalysis(true);
        if (fallbackLimit > 0) setAnalysisLimit(fallbackLimit);
        if (fallbackScore !== null) setTrustScore(fallbackScore);
      } catch {
        // Ignore malformed local cache.
      }
    };

    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const latestAnalysis = await backendRequest<{
          record: { summary: { trustScore: number; approvedLimit: number } };
        }>("/analysis/latest");

        if (!cancelled) {
          const nextScore = Number(latestAnalysis.record?.summary?.trustScore || 0);
          const nextLimit = Number(latestAnalysis.record?.summary?.approvedLimit || 0);
          setTrustScore(nextScore || null);
          setAnalysisLimit(nextLimit);
          setHasAnalysis(nextScore > 0 || nextLimit > 0);
        }
      } catch {
        if (!cancelled) hydrateFallbackLocal();
      }

      try {
        const latestLoan = await backendRequest<LatestLoanResponse>("/loans/latest");
        if (!cancelled && latestLoan?.loan) {
          setActiveLoan(latestLoan.loan);
          setRepayAmount(Math.max(0, Math.min(latestLoan.loan.emi, latestLoan.loan.remainingAmount)));
        }
      } catch {
        // No loan yet.
      }

      if (!cancelled) setIsLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!canApply) {
      setAmount(0);
      setTenure(1);
      return;
    }

    setAmount((prev) => Math.min(Math.max(prev, minAmount), maxLimit));
    setTenure((prev) => Math.min(Math.max(prev, 1), maxTenure));
  }, [canApply, maxLimit, maxTenure, minAmount]);

  useEffect(() => {
    if (!canApply || amount <= 0 || tenure <= 0) {
      setEmi(0);
      setTotalPayable(0);
      return;
    }

    const monthlyRate = policy.monthlyRate;
    const emiCalc =
      (amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) /
      (Math.pow(1 + monthlyRate, tenure) - 1);

    const computedEmi = Math.round(emiCalc);
    setEmi(computedEmi);
    setTotalPayable(Math.round(computedEmi * tenure));
  }, [amount, tenure, canApply, policy.monthlyRate]);

  const handleApply = async () => {
    if (!canApply) return;

    setIsApplying(true);
    setError("");
    setSuccess("");

    try {
      const response = await backendRequest<{ loan: LatestLoan }>("/loans", {
        method: "POST",
        body: {
          amount,
          tenureMonths: tenure,
        },
      });

      setActiveLoan(response.loan);
      setRepayAmount(Math.max(0, Math.min(response.loan.emi, response.loan.remainingAmount)));
      setSuccess("Loan approved and activated. Repayments are now tracked in backend.");
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : "Loan application failed.";
      setError(message);
    } finally {
      setIsApplying(false);
    }
  };

  const handleRepay = async () => {
    if (!activeLoan || activeLoan.status !== "ACTIVE") return;

    const normalized = Number(repayAmount || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      setError("Enter a valid repayment amount.");
      return;
    }

    setIsRepaying(true);
    setError("");
    setSuccess("");

    try {
      await backendRequest("/loans/repay", {
        method: "POST",
        body: {
          loanId: activeLoan.id,
          amount: normalized,
          method: "UPI",
        },
      });

      const refreshed = await backendRequest<LatestLoanResponse>("/loans/latest");
      setActiveLoan(refreshed.loan);
      setRepayAmount(Math.max(0, Math.min(refreshed.loan.emi, refreshed.loan.remainingAmount)));
      setSuccess("Repayment posted successfully.");
    } catch (repayError) {
      const message = repayError instanceof Error ? repayError.message : "Repayment failed.";
      setError(message);
    } finally {
      setIsRepaying(false);
    }
  };

  const tierColor =
    policy.tier === "PRIME"
      ? "text-teal-700 bg-teal-50 border-teal-100"
      : policy.tier === "PREFERRED"
        ? "text-cyan-700 bg-cyan-50 border-cyan-100"
        : policy.tier === "STANDARD"
          ? "text-amber-700 bg-amber-50 border-amber-100"
          : "text-stone-600 bg-stone-100 border-stone-200";

  return (
    <div className="bg-stone-50 font-sans min-h-screen pb-12">
      <Navbar showBack />

      <main className="max-w-2xl mx-auto p-6 mt-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-stone-800">Loan Application</h2>
          <p className="text-stone-500 text-sm mt-1">Loan approval is based on your Trust Score</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${tierColor}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-3.5 h-3.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {hasAnalysis ? `${policy.tier} TIER` : "ANALYSIS REQUIRED"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border border-stone-200 bg-white text-stone-600">
              Trust Score: {trustScore ?? "--"}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-2">{policy.reason}</p>
        </div>

        {/* Loan Customization Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200/60 mb-6">
          <h3 className="text-lg font-bold text-stone-800 mb-6">Customize Your Loan</h3>

          {/* Amount Slider */}
          <div className="mb-8">
            <div className="flex justify-between items-baseline mb-3">
              <label className="text-sm font-medium text-stone-600">Loan Amount</label>
              <span className="text-2xl font-bold text-teal-700">₹{canApply ? amount.toLocaleString() : "0"}</span>
            </div>
            <input
              type="range"
              min={minAmount}
              max={canApply ? maxLimit : 1000}
              step={amountStep}
              value={canApply ? amount : 0}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full disabled:opacity-40"
              disabled={!canApply || isLoading}
            />
            <div className="flex justify-between text-xs text-stone-400 mt-1">
              <span>₹{canApply ? "1,000" : "0"}</span>
              <span>₹{canApply ? maxLimit.toLocaleString() : "0"}</span>
            </div>
          </div>

          {/* Tenure Slider */}
          <div className="mb-8">
            <div className="flex justify-between items-baseline mb-3">
              <label className="text-sm font-medium text-stone-600">Repayment Tenure</label>
              <span className="text-2xl font-bold text-teal-700">{canApply ? tenure : 0} months</span>
            </div>
            <input
              type="range"
              min="1"
              max={maxTenure}
              step="1"
              value={canApply ? tenure : 1}
              onChange={(e) => setTenure(Number(e.target.value))}
              className="w-full disabled:opacity-40"
              disabled={!canApply || isLoading}
            />
            <div className="flex justify-between text-xs text-stone-400 mt-1">
              <span>1 month</span>
              <span>{maxTenure} months</span>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-stone-600">Monthly Interest</span>
              <span className="font-bold text-stone-800">{canApply ? `${(policy.monthlyRate * 100).toFixed(1)}%` : "--"}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-2">
              <span className="text-stone-600">Score-based Max Limit</span>
              <span className="font-bold text-stone-800">₹{canApply ? maxLimit.toLocaleString() : "0"}</span>
            </div>
          </div>
        </div>

        {/* EMI Summary */}
        <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-3xl p-8 text-white relative overflow-hidden mb-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <p className="text-stone-400 text-sm font-medium uppercase tracking-wide mb-2">Estimated EMI</p>
            <p className="text-4xl font-bold text-white mb-6">
              ₹{canApply ? emi.toLocaleString() : "0"}
              <span className="text-lg text-stone-400 font-normal">/month</span>
            </p>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-xs text-stone-400 mb-1">Principal</p>
                <p className="text-sm font-bold">₹{canApply ? amount.toLocaleString() : "0"}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-xs text-stone-400 mb-1">Total Payable</p>
                <p className="text-sm font-bold">₹{canApply ? totalPayable.toLocaleString() : "0"}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-xs text-stone-400 mb-1">Interest</p>
                <p className="text-sm font-bold text-amber-400">₹{canApply ? (totalPayable - amount).toLocaleString() : "0"}</p>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {success ? (
          <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm text-teal-700">{success}</p>
        ) : null}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link
            href="/"
            className="w-1/3 bg-stone-100 text-stone-600 font-semibold py-3.5 rounded-xl hover:bg-stone-200 transition text-center"
          >
            Cancel
          </Link>
          <button
            disabled={!canApply || isApplying || isLoading}
            onClick={handleApply}
            className="w-2/3 bg-teal-700 text-white font-bold py-3.5 rounded-xl hover:bg-teal-800 transition shadow-lg shadow-teal-700/20 disabled:bg-stone-300 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isApplying ? "Submitting..." : canApply ? "Apply for Loan" : "Not Eligible Yet"}
          </button>
        </div>

        {!hasAnalysis && (
          <p className="text-xs text-stone-500 mt-3">
            You need a Trust Score first.{" "}
            <Link href="/credit-analysis" className="text-teal-700 font-semibold hover:underline">
              Run credit analysis
            </Link>
            .
          </p>
        )}

        {activeLoan && (
          <section className="mt-6 rounded-3xl border border-stone-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-stone-800">Latest Loan</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeLoan.status === "ACTIVE" ? "bg-teal-100 text-teal-700" : "bg-stone-100 text-stone-700"}`}>
                {activeLoan.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-stone-500">Principal</p>
                <p className="mt-1 font-bold text-stone-800">₹{activeLoan.approvedAmount.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-stone-500">EMI</p>
                <p className="mt-1 font-bold text-stone-800">₹{activeLoan.emi.toLocaleString()}/month</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-stone-500">Paid</p>
                <p className="mt-1 font-bold text-stone-800">₹{activeLoan.paidAmount.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="text-stone-500">Remaining</p>
                <p className="mt-1 font-bold text-stone-800">₹{activeLoan.remainingAmount.toLocaleString()}</p>
              </div>
            </div>

            {activeLoan.status === "ACTIVE" && (
              <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
                <p className="text-sm font-semibold text-teal-800">Make repayment</p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max={activeLoan.remainingAmount}
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(Number(e.target.value || 0))}
                    className="flex-1 rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                    placeholder="Enter amount"
                  />
                  <button
                    onClick={handleRepay}
                    disabled={isRepaying}
                    className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {isRepaying ? "Processing..." : "Pay EMI"}
                  </button>
                </div>
                {activeLoan.nextDueDate ? (
                  <p className="mt-2 text-xs text-teal-700">Next due: {new Date(activeLoan.nextDueDate).toLocaleDateString()}</p>
                ) : null}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
