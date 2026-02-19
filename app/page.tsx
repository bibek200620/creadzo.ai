"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { backendRequest, getStoredUser, getToken } from "@/lib/backendClient";

const ANALYSIS_RETENTION_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYSIS_RETENTION_MS = ANALYSIS_RETENTION_DAYS * DAY_MS;

export default function HomePage() {
  const [creditLimit, setCreditLimit] = useState(0);
  const [trustScore, setTrustScore] = useState(0);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const hydrateFromLocalStorage = () => {
      const storedAnalysis = localStorage.getItem("credzoAnalysis");
      if (storedAnalysis) {
        try {
          const data = JSON.parse(storedAnalysis);
          const timestamp = typeof data?.timestamp === "number" ? data.timestamp : null;
          const isExpired = timestamp ? Date.now() >= timestamp + ANALYSIS_RETENTION_MS : false;

          if (isExpired) {
            localStorage.removeItem("credzoAnalysis");
            localStorage.removeItem("credzoAnalysisFull");
          } else {
            const parsedLimit = typeof data?.creditLimit === "number" ? data.creditLimit : 0;
            const parsedScore = typeof data?.trustScore === "number" ? data.trustScore : 0;
            setCreditLimit(parsedLimit);
            setTrustScore(parsedScore);
            setHasAnalysis(parsedLimit > 0 || parsedScore > 0);
          }
        } catch {
          // Ignore malformed localStorage values
        }
      }

      const storedUser = localStorage.getItem("credzoUser");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (typeof parsedUser?.name === "string" && parsedUser.name.trim()) {
            setUserName(parsedUser.name.split(" ")[0]);
          }
        } catch {
          // Ignore malformed localStorage values
        }
      }
    };

    hydrateFromLocalStorage();

    const token = getToken();
    if (!token) return;

    const localUser = getStoredUser();
    if (localUser?.name) {
      setUserName(localUser.name.split(" ")[0]);
    }

    let cancelled = false;
    const loadFromBackend = async () => {
      try {
        const me = await backendRequest<{ user: { name: string } }>("/auth/me");
        if (!cancelled && me.user?.name) {
          setUserName(me.user.name.split(" ")[0] || "User");
        }

        const latest = await backendRequest<{
          record: { summary: { trustScore: number; approvedLimit: number }; analyzedAt: string };
        }>("/analysis/latest");

        if (!cancelled && latest?.record?.summary) {
          const backendScore = Number(latest.record.summary.trustScore || 0);
          const backendLimit = Number(latest.record.summary.approvedLimit || 0);

          setTrustScore(backendScore);
          setCreditLimit(backendLimit);
          setHasAnalysis(backendScore > 0 || backendLimit > 0);

          localStorage.setItem("credzoAnalysis", JSON.stringify({
            creditLimit: backendLimit,
            trustScore: backendScore,
            trustLevel: "",
            scorePercentile: 0,
            repaymentCapacity: 0,
            timestamp: new Date(latest.record.analyzedAt).getTime(),
          }));
        }
      } catch {
        // Keep local fallback if backend fails
      }
    };

    loadFromBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  const clampedTrustScore = Math.max(0, Math.min(900, trustScore));
  const trustPercent = Math.round((clampedTrustScore / 900) * 100);
  const trustedLevel = clampedTrustScore >= 750 ? "High Trust" : clampedTrustScore >= 600 ? "Moderate Trust" : "Building Trust";
  const scoreOffset = 339 - (339 * clampedTrustScore) / 900;
  const trustTierClasses = clampedTrustScore >= 750
    ? "border-teal-200 bg-teal-50 text-teal-800"
    : clampedTrustScore >= 600
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-700";
  const nextMilestone = clampedTrustScore >= 750 ? 900 : clampedTrustScore >= 600 ? 750 : 600;
  const nextMilestoneLabel = nextMilestone === 900 ? "Excellent Tier" : nextMilestone === 750 ? "High Trust" : "Moderate Trust";
  const pointsToMilestone = Math.max(0, nextMilestone - clampedTrustScore);
  const profileStability = hasAnalysis ? Math.max(35, Math.min(99, Math.round(trustPercent * 0.92))) : 0;
  const repaymentReadiness = hasAnalysis ? Math.max(28, Math.min(99, Math.round(trustPercent * 0.87))) : 0;

  const scoreMessage = useMemo(() => {
    if (!hasAnalysis) return "Analyze your bank statement to generate your trust score and credit line.";
    if (clampedTrustScore >= 750) return "Your profile shows strong consistency and repayment capacity.";
    if (clampedTrustScore >= 600) return "You have a healthy base profile with room to increase limit confidence.";
    return "You are in early profile-building stage. Regular transaction history will improve this.";
  }, [clampedTrustScore, hasAnalysis]);

  return (
    <div className="app-shell">
      <Navbar />

      <main className="page-wrap space-y-6 md:space-y-7">
        <section className="soft-card relative overflow-hidden p-6 md:p-8">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-200/45 blur-3xl" />
          <div className="absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-amber-200/45 blur-3xl" />

          <div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Dashboard</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">
                Welcome back, {userName}
              </h1>
              <p className="mt-3 max-w-xl text-sm text-slate-600 md:text-base">
                Your financial profile is updated in one place. Track your trust score, manage linked accounts, and unlock responsible credit.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/credit-analysis" className="btn-primary">
                  Analyze Statement
                </Link>
                <Link href="/profile" className="btn-secondary">
                  View Profile
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Approved Limit</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  ₹{(hasAnalysis ? creditLimit : 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Trust Score</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {hasAnalysis ? `${clampedTrustScore}/900` : "--"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div className="soft-card p-6 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Credzo Micro Credit Line</p>
                <h2 className="mt-1 text-3xl font-bold text-slate-900 md:text-4xl">
                  ₹{(hasAnalysis ? creditLimit : 0).toLocaleString()}
                </h2>
              </div>
              <Link href="/loan-application" className="btn-primary">
                Apply for Loan
              </Link>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>Utilization</span>
                <span>0%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-0 rounded-full bg-teal-500" />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Use a small amount and repay on time to improve your next limit increase.
              </p>
            </div>
          </div>

          <div className="soft-card relative overflow-hidden p-6 md:p-7">
            <div className="absolute -right-14 -top-12 h-44 w-44 rounded-full bg-teal-200/35 blur-3xl" />
            <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trust Summary</p>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${trustTierClasses}`}>
                  {hasAnalysis ? trustedLevel : "Pending Analysis"}
                </span>
              </div>

              <div className="mt-4 grid gap-4">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="relative grid h-32 w-32 place-items-center">
                    <svg className="h-32 w-32 -rotate-90" viewBox="0 0 128 128">
                      <circle className="text-slate-200" strokeWidth="10" stroke="currentColor" fill="transparent" r="54" cx="64" cy="64" />
                      <circle
                        className="text-teal-500"
                        strokeWidth="10"
                        strokeDasharray="339"
                        strokeDashoffset={hasAnalysis ? scoreOffset : 339}
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
                      <span className="block text-3xl font-bold text-slate-900">{hasAnalysis ? clampedTrustScore : "--"}</span>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">/ 900</span>
                    </span>
                  </div>

                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-semibold text-slate-800">{hasAnalysis ? `Top ${100 - trustPercent}% percentile` : "No percentile yet"}</p>
                    <p className="text-sm text-slate-600">{scoreMessage}</p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="rounded-xl border border-slate-200 bg-white/85 p-2.5">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Profile Stability</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">{hasAnalysis ? `${profileStability}%` : "--"}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white/85 p-2.5">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Repayment Readiness</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">{hasAnalysis ? `${repaymentReadiness}%` : "--"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/85 p-3.5">
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <span>Score Progress</span>
                    <span>{hasAnalysis ? `${trustPercent}%` : "0%"}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-700"
                      style={{ width: `${hasAnalysis ? trustPercent : 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {hasAnalysis
                      ? `${pointsToMilestone} points to ${nextMilestoneLabel}`
                      : "Run your first analysis to unlock milestone tracking."}
                  </p>
                </div>
              </div>

              <Link href={hasAnalysis ? "/full-review" : "/credit-analysis"} className="btn-secondary mt-5 w-full">
                {hasAnalysis ? "Open Full Review" : "Run Credit Analysis"}
              </Link>
            </div>
          </div>
        </section>

        <section className="soft-card p-6 md:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Full Review</p>
          <div className="mt-3 rounded-2xl border border-dashed border-teal-300 bg-teal-50/60 p-6">
            <h3 className="text-xl font-bold text-slate-900">
              {hasAnalysis ? "Your detailed credit review is ready" : "Generate your first full review"}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {hasAnalysis
                ? "Open your complete review with trust score graphs, spending breakdown, risk insights, and credit limit details."
                : "Upload your latest statement to unlock full review graphs, trust score, and risk insights."}
            </p>
            <Link
              href={hasAnalysis ? "/full-review" : "/credit-analysis"}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"
            >
              {hasAnalysis ? "Open full review" : "Start analysis"}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Link href="/bank-accounts" className="soft-card p-5 hover:-translate-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bank Accounts</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">Manage linked accounts</h3>
            <p className="mt-1 text-sm text-slate-600">Add or review connected bank details used for analysis.</p>
          </Link>

          <Link href={hasAnalysis ? "/full-review" : "/credit-analysis"} className="soft-card p-5 hover:-translate-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Full Review</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">See full score details</h3>
            <p className="mt-1 text-sm text-slate-600">Open score graphs, spending signals, and complete trust factor analysis.</p>
          </Link>

          <Link href="/loan-application" className="soft-card p-5 hover:-translate-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Micro-Loan</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">Customize your offer</h3>
            <p className="mt-1 text-sm text-slate-600">Select amount and tenure from your approved credit line.</p>
          </Link>
        </section>
      </main>
    </div>
  );
}
