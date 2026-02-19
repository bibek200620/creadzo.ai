"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { backendRequest, getToken } from "@/lib/backendClient";

interface ScoreBreakdown {
  incomeStability: number;
  spendingDiscipline: number;
  savingsBehavior: number;
  paymentConsistency: number;
  accountHealth: number;
}

interface ScoreOverview {
  trustScore: number;
  trustLevel: string;
  scoreExplanation: string;
  scoreBreakdown: ScoreBreakdown;
}

interface Factor {
  factor: string;
  impact: string;
  detail: string;
}

interface Advice {
  title: string;
  description: string;
  potentialImpact: string;
}

interface ImprovementSuggestions {
  whyThisScore: string;
  factors: Factor[];
  actionableAdvice: Advice[];
}

interface SpendingCategory {
  name: string;
  percentage: number;
  amount: number;
  color: string;
}

interface SpendingAnalysis {
  categories: SpendingCategory[];
  totalSpending: number;
  totalIncome: number;
  savingsRate: number;
  spendingHabitsText: string;
}

interface SpendingBehavior {
  patterns: string[];
  unusualActivity: string;
  consistencyScore: string;
}

interface AiInsights {
  financialHealthSummary: string;
  riskLevel: string;
  riskExplanation: string;
  spendingBehavior: SpendingBehavior;
}

interface PositiveSignal {
  signal: string;
  description: string;
  strength: string;
}

interface MissingSignal {
  signal: string;
  howToFix: string;
}

interface RiskFactor {
  factor: string;
  traditionalBankView: string;
  credzoView: string;
}

interface TrustFactorAnalysis {
  positiveSignals: PositiveSignal[];
  missingSignals: MissingSignal[];
  riskFactors: RiskFactor[];
}

interface LimitFactor {
  factor: string;
  impact: string;
  detail: string;
}

interface CreditLimitBreakdown {
  approvedLimit: number;
  maxEligibleLimit: number;
  limitReasoning: string;
  incomeToLimitRatio: string;
  limitFactors: LimitFactor[];
  repaymentCapacity: number;
  confidenceLevel: string;
}

interface FullAnalysis {
  scoreOverview: ScoreOverview;
  improvementSuggestions: ImprovementSuggestions;
  spendingAnalysis: SpendingAnalysis;
  aiInsights: AiInsights;
  trustFactorAnalysis: TrustFactorAnalysis;
  creditLimitBreakdown: CreditLimitBreakdown;
  recommendedCreditLimit: number;
  scorePercentile: number;
}

interface StoredFullAnalysis {
  analysis: FullAnalysis;
  analyzedAt: number;
  expiresAt: number;
}

interface StoredSummary {
  creditLimit: number;
  trustScore: number;
  trustLevel: string;
  scorePercentile: number;
  repaymentCapacity: number;
  timestamp: number;
}

const FULL_ANALYSIS_STORAGE_KEY = "credzoAnalysisFull";
const SUMMARY_KEY = "credzoAnalysis";
const ANALYSIS_RETENTION_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYSIS_RETENTION_MS = ANALYSIS_RETENTION_DAYS * DAY_MS;

function parseStoredFullAnalysis(raw: string | null): StoredFullAnalysis | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const analyzedAt = typeof parsed?.analyzedAt === "number" ? parsed.analyzedAt : null;
    const expiresAt = typeof parsed?.expiresAt === "number" ? parsed.expiresAt : null;
    const analysis = parsed?.analysis;

    if (!analyzedAt || !expiresAt || !analysis || typeof analysis !== "object") {
      return null;
    }

    const analysisRecord = analysis as Record<string, unknown>;
    if (!analysisRecord.scoreOverview || !analysisRecord.creditLimitBreakdown) {
      return null;
    }

    return {
      analysis: analysis as FullAnalysis,
      analyzedAt,
      expiresAt,
    };
  } catch {
    return null;
  }
}

function parseStoredSummary(raw: string | null): StoredSummary | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const creditLimit = typeof parsed?.creditLimit === "number" ? parsed.creditLimit : 0;
    const trustScore = typeof parsed?.trustScore === "number" ? parsed.trustScore : 0;
    const trustLevel = typeof parsed?.trustLevel === "string" ? parsed.trustLevel : "";
    const scorePercentile = typeof parsed?.scorePercentile === "number" ? parsed.scorePercentile : 0;
    const repaymentCapacity = typeof parsed?.repaymentCapacity === "number" ? parsed.repaymentCapacity : 0;
    const timestamp = typeof parsed?.timestamp === "number" ? parsed.timestamp : 0;

    if (!creditLimit && !trustScore) return null;

    return {
      creditLimit,
      trustScore,
      trustLevel,
      scorePercentile,
      repaymentCapacity,
      timestamp,
    };
  } catch {
    return null;
  }
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "--";
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getTrustBadge(score: number): string {
  if (score >= 800) return "Excellent Trust";
  if (score >= 700) return "High Trust";
  if (score >= 600) return "Moderate Trust";
  return "Building Trust";
}

export default function FullReviewPage() {
  const [analysis, setAnalysis] = useState<FullAnalysis | null>(null);
  const [summary, setSummary] = useState<StoredSummary | null>(null);
  const [analysisGeneratedAt, setAnalysisGeneratedAt] = useState<number | null>(null);
  const [analysisExpiresAt, setAnalysisExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const storedFull = parseStoredFullAnalysis(localStorage.getItem(FULL_ANALYSIS_STORAGE_KEY));
    const storedSummary = parseStoredSummary(localStorage.getItem(SUMMARY_KEY));

    if (storedFull) {
      if (now >= storedFull.expiresAt) {
        localStorage.removeItem(FULL_ANALYSIS_STORAGE_KEY);
        localStorage.removeItem(SUMMARY_KEY);
        setError("Your previous review has expired. Upload a new PDF to generate a fresh full review.");
      } else {
        setAnalysis(storedFull.analysis);
        setAnalysisGeneratedAt(storedFull.analyzedAt);
        setAnalysisExpiresAt(storedFull.expiresAt);
        if (storedSummary) setSummary(storedSummary);
        return () => {
          cancelled = true;
        };
      }
    }

    if (storedSummary) {
      const expiresAt = storedSummary.timestamp
        ? storedSummary.timestamp + ANALYSIS_RETENTION_MS
        : null;

      if (expiresAt && now >= expiresAt) {
        localStorage.removeItem(SUMMARY_KEY);
        setError("Your previous review has expired. Upload a new PDF to continue.");
      } else {
        setSummary(storedSummary);
        if (storedSummary.timestamp) {
          setAnalysisGeneratedAt(storedSummary.timestamp);
          setAnalysisExpiresAt(storedSummary.timestamp + ANALYSIS_RETENTION_MS);
        }
      }
    }

    const token = getToken();
    if (!token) {
      return () => {
        cancelled = true;
      };
    }

    const restoreFromBackend = async () => {
      try {
        const latest = await backendRequest<{
          record: {
            analysis: FullAnalysis;
            analyzedAt: string;
            expiresAt: string;
            summary: {
              trustScore: number;
              trustLevel: string;
              scorePercentile: number;
              approvedLimit: number;
              repaymentCapacity: number;
            };
          };
        }>("/analysis/latest");

        if (cancelled || !latest?.record?.analysis) return;

        const analyzedAt = new Date(latest.record.analyzedAt).getTime();
        const expiresAt = new Date(latest.record.expiresAt).getTime();
        if (!analyzedAt || !expiresAt || Date.now() >= expiresAt) return;

        setAnalysis(latest.record.analysis);
        setAnalysisGeneratedAt(analyzedAt);
        setAnalysisExpiresAt(expiresAt);
        setSummary({
          creditLimit: Number(latest.record.summary?.approvedLimit || 0),
          trustScore: Number(latest.record.summary?.trustScore || 0),
          trustLevel: latest.record.summary?.trustLevel || "",
          scorePercentile: Number(latest.record.summary?.scorePercentile || 0),
          repaymentCapacity: Number(latest.record.summary?.repaymentCapacity || 0),
          timestamp: analyzedAt,
        });
        setError("");

        localStorage.setItem(SUMMARY_KEY, JSON.stringify({
          creditLimit: Number(latest.record.summary?.approvedLimit || 0),
          trustScore: Number(latest.record.summary?.trustScore || 0),
          trustLevel: latest.record.summary?.trustLevel || "",
          scorePercentile: Number(latest.record.summary?.scorePercentile || 0),
          repaymentCapacity: Number(latest.record.summary?.repaymentCapacity || 0),
          timestamp: analyzedAt,
        }));
        localStorage.setItem(FULL_ANALYSIS_STORAGE_KEY, JSON.stringify({
          analysis: latest.record.analysis,
          analyzedAt,
          expiresAt,
        }));
      } catch {
        // Keep local fallback only.
      }
    };

    restoreFromBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  const score = analysis?.scoreOverview?.trustScore ?? summary?.trustScore ?? 0;
  const clampedScore = Math.max(0, Math.min(900, score));
  const scorePercent = Math.round((clampedScore / 900) * 100);
  const scoreOffset = 339 - (339 * clampedScore) / 900;
  const trustLabel = analysis?.scoreOverview?.trustLevel || summary?.trustLevel || getTrustBadge(clampedScore);
  const approvedLimit = analysis?.creditLimitBreakdown?.approvedLimit
    || analysis?.recommendedCreditLimit
    || summary?.creditLimit
    || 0;
  const scorePercentile = analysis?.scorePercentile ?? summary?.scorePercentile ?? 0;

  const scoreBreakdownEntries = analysis
    ? (Object.entries(analysis.scoreOverview.scoreBreakdown) as [string, number][])
    : [];
  const spendingCategories = analysis?.spendingAnalysis?.categories || [];
  const improvementAdvice = analysis?.improvementSuggestions?.actionableAdvice || [];

  const lockDaysLeft = useMemo(() => {
    if (!analysisExpiresAt) return 0;
    return Math.max(0, Math.ceil((analysisExpiresAt - Date.now()) / DAY_MS));
  }, [analysisExpiresAt]);

  const renderPieChart = (categories: SpendingCategory[]) => {
    let cumulativePercent = 0;
    const size = 200;
    const radius = 80;
    const cx = size / 2;
    const cy = size / 2;

    if (!categories.length) {
      return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-52 h-52">
          <circle cx={cx} cy={cy} r={radius} fill="#e7e5e4" />
          <circle cx={cx} cy={cy} r="45" fill="white" />
        </svg>
      );
    }

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-52 h-52">
        {categories.map((cat, i) => {
          const startAngle = cumulativePercent * 3.6 * (Math.PI / 180);
          cumulativePercent += cat.percentage;
          const endAngle = cumulativePercent * 3.6 * (Math.PI / 180);
          const largeArc = cat.percentage > 50 ? 1 : 0;

          const x1 = cx + radius * Math.cos(startAngle - Math.PI / 2);
          const y1 = cy + radius * Math.sin(startAngle - Math.PI / 2);
          const x2 = cx + radius * Math.cos(endAngle - Math.PI / 2);
          const y2 = cy + radius * Math.sin(endAngle - Math.PI / 2);

          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={cat.color}
              stroke="white"
              strokeWidth="2"
            />
          );
        })}
        <circle cx={cx} cy={cy} r="45" fill="white" />
      </svg>
    );
  };

  return (
    <div className="app-shell">
      <Navbar showBack />

      <main className="page-wrap space-y-6 md:space-y-7">
        <section className="soft-card relative overflow-hidden p-6 md:p-8">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-200/45 blur-3xl" />
          <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-amber-200/45 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Review Center</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Full Credit Review</h1>
              <p className="mt-2 text-sm text-slate-600">
                Complete trust score, graphs, and risk-level breakdown from your saved analysis.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Analyzed: {formatDate(analysisGeneratedAt)}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Refresh in: {lockDaysLeft > 0 ? `${lockDaysLeft} day${lockDaysLeft > 1 ? "s" : ""}` : "Available now"}
              </span>
            </div>
          </div>
        </section>

        {error && (
          <section className="soft-card border border-red-200 bg-red-50/75 p-5">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </section>
        )}

        {!analysis && !summary && (
          <section className="soft-card p-7 text-center">
            <h2 className="text-2xl font-bold text-slate-900">No review data yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Upload your bank statement PDF to generate a full trust review with score graphs and detailed insights.
            </p>
            <Link href="/credit-analysis" className="btn-primary mt-5">
              Run Credit Analysis
            </Link>
          </section>
        )}

        {!analysis && summary && (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="soft-card p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Score Snapshot</p>
              <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="relative grid h-32 w-32 place-items-center">
                  <svg className="h-32 w-32 -rotate-90" viewBox="0 0 128 128">
                    <circle className="text-slate-200" strokeWidth="10" stroke="currentColor" fill="transparent" r="54" cx="64" cy="64" />
                    <circle
                      className="text-teal-500"
                      strokeWidth="10"
                      strokeDasharray="339"
                      strokeDashoffset={scoreOffset}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="54"
                      cx="64"
                      cy="64"
                    />
                  </svg>
                  <span className="absolute text-center">
                    <span className="block text-3xl font-bold text-slate-900">{clampedScore || "--"}</span>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">/ 900</span>
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-800">{trustLabel}</p>
                  <p className="mt-1 text-sm text-slate-600">Approved limit: ₹{approvedLimit.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">Score progress: {scorePercent}%</p>
                </div>
              </div>
            </div>

            <div className="soft-card p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Limited Data</p>
              <h3 className="mt-2 text-xl font-bold text-slate-900">Detailed review graphs are unavailable</h3>
              <p className="mt-2 text-sm text-slate-600">
                This browser currently has summary data only. Open credit analysis to sync the full review details.
              </p>
              <Link href="/credit-analysis" className="btn-secondary mt-5">
                Open Credit Analysis
              </Link>
            </div>
          </section>
        )}

        {analysis && (
          <>
            <section className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
              <div className="soft-card p-6 md:p-7">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trust Score</p>
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                    {trustLabel}
                  </span>
                </div>

                <div className="mt-4 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                  <div className="relative grid h-36 w-36 place-items-center">
                    <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128">
                      <circle className="text-slate-200" strokeWidth="10" stroke="currentColor" fill="transparent" r="54" cx="64" cy="64" />
                      <circle
                        className="text-teal-500"
                        strokeWidth="10"
                        strokeDasharray="339"
                        strokeDashoffset={scoreOffset}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="54"
                        cx="64"
                        cy="64"
                        style={{ transition: "stroke-dashoffset 0.9s ease" }}
                      />
                    </svg>
                    <span className="absolute text-center">
                      <span className="block text-4xl font-bold text-slate-900">{clampedScore}</span>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">/ 900</span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-800">
                      Top {Math.max(0, 100 - scorePercentile)}% percentile
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {analysis.scoreOverview.scoreExplanation}
                    </p>
                  </div>
                </div>
              </div>

              <div className="soft-card p-6 md:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Credit Limit</p>
                <h2 className="mt-2 text-4xl font-bold text-slate-900">
                  ₹{(analysis.creditLimitBreakdown?.approvedLimit || analysis.recommendedCreditLimit).toLocaleString()}
                </h2>
                <p className="mt-2 text-sm text-slate-600">{analysis.creditLimitBreakdown.limitReasoning}</p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Income Ratio</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{analysis.creditLimitBreakdown.incomeToLimitRatio}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Repayment Capacity</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">₹{analysis.creditLimitBreakdown.repaymentCapacity.toLocaleString()}</p>
                  </div>
                </div>

                {analysis.creditLimitBreakdown.limitFactors.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {analysis.creditLimitBreakdown.limitFactors.slice(0, 4).map((lf, i) => (
                      <span
                        key={i}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          lf.impact === "POSITIVE"
                            ? "border-teal-200 bg-teal-50 text-teal-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {lf.impact === "POSITIVE" ? "Positive" : "Risk"}: {lf.factor}
                      </span>
                    ))}
                  </div>
                )}

                <Link href="/loan-application" className="btn-primary mt-5">
                  Apply for Loan
                </Link>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="soft-card p-6 md:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Score Breakdown</p>
                <div className="mt-4 space-y-3">
                  {scoreBreakdownEntries.map(([key, value]) => (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold capitalize text-slate-600">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <span className="font-bold text-slate-800">{value}/100</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            value >= 75 ? "bg-teal-500" : value >= 50 ? "bg-amber-500" : "bg-red-400"
                          }`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-800">Why this score</p>
                  <p className="mt-1 text-sm text-slate-600">{analysis.improvementSuggestions.whyThisScore}</p>
                </div>
              </div>

              <div className="soft-card p-6 md:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Spending Graph</p>
                <div className="mt-4 flex justify-center">{renderPieChart(spendingCategories)}</div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-teal-100 bg-teal-50 p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Income</p>
                    <p className="mt-1 text-sm font-bold text-teal-700">₹{analysis.spendingAnalysis.totalIncome.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Spending</p>
                    <p className="mt-1 text-sm font-bold text-slate-700">₹{analysis.spendingAnalysis.totalSpending.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Savings</p>
                    <p className="mt-1 text-sm font-bold text-amber-700">{analysis.spendingAnalysis.savingsRate}%</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {spendingCategories.map((cat, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="flex-1 text-slate-600">{cat.name}</span>
                      <span className="font-semibold text-slate-700">{cat.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="soft-card p-6 md:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI Insights</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{analysis.aiInsights.financialHealthSummary}</p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Risk Level</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{analysis.aiInsights.riskLevel}</p>
                    <p className="mt-1 text-xs text-slate-500">{analysis.aiInsights.riskExplanation}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Consistency</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{analysis.aiInsights.spendingBehavior.consistencyScore}</p>
                    <p className="mt-1 text-xs text-slate-500">{analysis.aiInsights.spendingBehavior.unusualActivity}</p>
                  </div>
                </div>

                {analysis.aiInsights.spendingBehavior.patterns.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {analysis.aiInsights.spendingBehavior.patterns.map((pattern, i) => (
                      <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {pattern}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="soft-card p-6 md:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Action Plan</p>
                <div className="mt-4 space-y-3">
                  {improvementAdvice.slice(0, 4).map((advice, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-sm font-semibold text-slate-800">{advice.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{advice.description}</p>
                      <span className="mt-2 inline-flex rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                        {advice.potentialImpact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="soft-card p-6 md:p-7">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Positive Signals</p>
                  <p className="mt-1 text-2xl font-bold text-teal-700">{analysis.trustFactorAnalysis.positiveSignals.length}</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Missing Signals</p>
                  <p className="mt-1 text-2xl font-bold text-amber-700">{analysis.trustFactorAnalysis.missingSignals.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Risk Factors</p>
                  <p className="mt-1 text-2xl font-bold text-slate-700">{analysis.trustFactorAnalysis.riskFactors.length}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-bold text-slate-800">Top Positive Signals</p>
                  <div className="mt-2 space-y-2">
                    {analysis.trustFactorAnalysis.positiveSignals.slice(0, 3).map((signal, i) => (
                      <div key={i}>
                        <p className="text-sm font-semibold text-slate-700">{signal.signal}</p>
                        <p className="text-xs text-slate-500">{signal.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-bold text-slate-800">Top Missing Signals</p>
                  <div className="mt-2 space-y-2">
                    {analysis.trustFactorAnalysis.missingSignals.slice(0, 3).map((signal, i) => (
                      <div key={i}>
                        <p className="text-sm font-semibold text-slate-700">{signal.signal}</p>
                        <p className="text-xs text-slate-500">{signal.howToFix}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
