import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler);

const pieColors = ["#0f766e", "#14b8a6", "#06b6d4", "#f59e0b", "#6366f1", "#ef4444", "#84cc16"];

function formatDate(date) {
  if (!date) return "--";
  return new Date(date).toLocaleDateString();
}

export default function DashboardPage() {
  const { user } = useAuth();
  const loanCtaLabel = user?.role === "ADMIN" ? "Loan Approvals" : "Loan Center";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [historyPreview, setHistoryPreview] = useState([]);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      setHistoryError("");

      const [summaryResult, historyResult] = await Promise.allSettled([
        api.get("/analytics/summary"),
        api.get("/analytics/history?limit=5"),
      ]);

      if (summaryResult.status === "fulfilled") {
        setPayload(summaryResult.value.data);
      } else {
        const status = summaryResult.reason?.response?.status;
        if (status === 404) {
          setPayload(null);
          setError("No statement found yet. Upload PDF/CSV to generate analytics.");
        } else {
          setError(summaryResult.reason?.response?.data?.message || "Failed to load dashboard");
        }
      }

      if (historyResult.status === "fulfilled") {
        setHistoryPreview(historyResult.value.data?.history || []);
      } else {
        setHistoryError("History preview unavailable right now.");
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const monthlySeries = payload?.analytics?.monthlySeries || [];
  const categorySpending = payload?.analytics?.categorySpending || [];
  const trendSeries = payload?.analytics?.transactionTrend || [];

  const recommendations = payload?.recommendations?.recommendations || [];
  const riskFlags = payload?.recommendations?.riskFlags || [];

  const barData = useMemo(() => ({
    labels: monthlySeries.map((m) => m.month),
    datasets: [
      {
        label: "Income",
        data: monthlySeries.map((m) => m.income),
        backgroundColor: "rgba(13, 148, 136, 0.75)",
        borderRadius: 8,
      },
      {
        label: "Expenses",
        data: monthlySeries.map((m) => m.expenses),
        backgroundColor: "rgba(249, 115, 22, 0.72)",
        borderRadius: 8,
      },
    ],
  }), [monthlySeries]);

  const pieData = useMemo(() => ({
    labels: categorySpending.map((category) => category.category),
    datasets: [
      {
        data: categorySpending.map((category) => category.amount),
        backgroundColor: categorySpending.map((_, index) => pieColors[index % pieColors.length]),
      },
    ],
  }), [categorySpending]);

  const lineData = useMemo(() => {
    const slice = trendSeries.slice(-30);
    return {
      labels: slice.map((point) => point.date),
      datasets: [
        {
          label: "Balance Trend",
          data: slice.map((point) => point.balance),
          borderColor: "#0f766e",
          backgroundColor: "rgba(15,118,110,0.15)",
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    };
  }, [trendSeries]);

  return (
    <Layout>
      <section className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">
            Welcome, {user?.name || "User"}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Track your Trust Score from bank transaction behavior.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/upload" className="btn-primary">Upload Bank Statement</Link>
          <Link to="/score" className="btn-secondary">View Score Breakdown</Link>
          <Link to="/loan" className="btn-secondary">{loanCtaLabel}</Link>
          <Link to="/history" className="btn-secondary">History</Link>
        </div>
      </section>

      {loading ? (
        <div className="card">
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading analytics...</p>
        </div>
      ) : null}

      {!loading && error && !payload ? (
        <div className="card">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <Link to="/upload" className="btn-primary mt-4">Upload Statement</Link>
        </div>
      ) : null}

      {!loading && payload ? (
        <>
          {error ? <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">{error}</p> : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Trust Score"
              value={`${payload.score?.trustScore || 0}/900`}
              subtext={payload.score?.scoreBand || "Not generated"}
              tone="success"
            />
            <StatCard
              label="Avg Monthly Income"
              value={`₹${(payload.analytics?.metrics?.averageMonthlyIncome || 0).toLocaleString()}`}
              subtext="Based on parsed statement months"
            />
            <StatCard
              label="Avg Monthly Expenses"
              value={`₹${(payload.analytics?.metrics?.averageMonthlyExpenses || 0).toLocaleString()}`}
              subtext="Includes categorized outflows"
              tone="warning"
            />
            <StatCard
              label="Savings Ratio"
              value={`${Math.round((payload.analytics?.metrics?.savingsRatio || 0) * 100)}%`}
              subtext="Income retained after expenses"
            />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Monthly Income vs Expenses</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Cashflow consistency across statement months.</p>
              <div className="mt-4 h-[320px]">
                <Bar
                  data={barData}
                  options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    plugins: { legend: { position: "top" } },
                  }}
                />
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Category-wise Spending</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Rule-based expense tagging from statement narration.</p>
              <div className="mt-4 h-[320px]">
                <Pie
                  data={pieData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "bottom" } },
                  }}
                />
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Transaction Trend Line</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Running account balance over recent transactions.</p>
              <div className="mt-4 h-[300px]">
                <Line
                  data={lineData}
                  options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    plugins: { legend: { position: "top" } },
                  }}
                />
              </div>
            </div>

            <div className="card">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Recent Statements</h2>
                <Link to="/history" className="text-xs font-semibold text-brand-700 dark:text-brand-300">View All</Link>
              </div>

              {historyError ? <p className="text-sm text-amber-700 dark:text-amber-300">{historyError}</p> : null}

              {historyPreview.length > 0 ? (
                <div className="space-y-2">
                  {historyPreview.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.fileName}</p>
                        <span className="text-sm font-bold text-brand-700 dark:text-brand-300">{item.trustScore}/900</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(item.uploadedAt)} • {item.scoreBand}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">No recent history to display.</p>
              )}
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Actionable Recommendations</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Personalized actions from current behavioral signals.</p>

              {recommendations.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {recommendations.slice(0, 3).map((rec) => (
                    <div key={rec.code} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{rec.title}</p>
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                          {rec.potentialScoreImpact}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Priority: {rec.priority}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{rec.action}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No recommendations available for this statement.</p>
              )}
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Risk Alerts</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Detected warning flags from transaction analytics.</p>

              {riskFlags.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {riskFlags.map((flag) => (
                    <li key={flag} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                      {flag}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">No major risk alerts detected on the latest statement.</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </Layout>
  );
}
