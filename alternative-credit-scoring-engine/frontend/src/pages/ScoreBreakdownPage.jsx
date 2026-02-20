import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import Layout from "../components/Layout";
import api from "../api/client";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function getScoreColor(score) {
  if (score >= 780) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 680) return "text-teal-700 dark:text-teal-300";
  if (score >= 560) return "text-amber-700 dark:text-amber-300";
  return "text-red-700 dark:text-red-300";
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export default function ScoreBreakdownPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scoreData, setScoreData] = useState(null);
  const [exportingFormat, setExportingFormat] = useState("");
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    const fetchScore = async () => {
      setLoading(true);
      setError("");

      try {
        const { data } = await api.get("/score/generate");
        setScoreData(data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch score breakdown");
      } finally {
        setLoading(false);
      }
    };

    fetchScore();
  }, []);

  const barData = useMemo(() => {
    if (!scoreData?.componentBreakdown) return null;

    return {
      labels: scoreData.componentBreakdown.map((c) => c.name),
      datasets: [
        {
          label: "Component Raw Score (0-100)",
          data: scoreData.componentBreakdown.map((c) => c.rawScore),
          backgroundColor: "rgba(20,184,166,0.75)",
          borderRadius: 8,
        },
      ],
    };
  }, [scoreData]);

  const score = scoreData?.trustScore || 0;
  const scorePercent = Math.round((score / 900) * 100);
  const recommendations = scoreData?.recommendations?.recommendations || [];

  const handleExport = async (format) => {
    setExportingFormat(format);
    setExportError("");

    try {
      const response = await api.get(`/score/report?format=${format}`, {
        responseType: "blob",
      });

      const filename = `score-report-latest.${format === "csv" ? "csv" : "json"}`;
      downloadBlob(response.data, filename);
    } catch {
      setExportError("Failed to export report. Please try again.");
    } finally {
      setExportingFormat("");
    }
  };

  return (
    <Layout>
      <section className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Trust Score Breakdown</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">Alternative Credit Score Engine</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={exportingFormat === "json"}
            onClick={() => handleExport("json")}
          >
            {exportingFormat === "json" ? "Exporting JSON..." : "Export JSON"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={exportingFormat === "csv"}
            onClick={() => handleExport("csv")}
          >
            {exportingFormat === "csv" ? "Exporting CSV..." : "Export CSV"}
          </button>
          <Link to="/loan" className="btn-secondary">Loan Center</Link>
          <Link to="/upload" className="btn-primary">Upload New Statement</Link>
        </div>
      </section>

      {loading ? (
        <div className="card"><p className="text-sm text-slate-600 dark:text-slate-300">Generating score breakdown...</p></div>
      ) : null}

      {!loading && error ? (
        <div className="card">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <Link to="/upload" className="btn-primary mt-4">Upload Statement</Link>
        </div>
      ) : null}

      {!loading && !error && scoreData ? (
        <>
          {exportError ? (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {exportError}
            </div>
          ) : null}

          <section className="card">
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr] md:items-center">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Credit Score</p>
                <p className={`mt-1 text-5xl font-bold ${getScoreColor(score)}`}>{score}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Band: <strong>{scoreData.scoreBand}</strong>
                </p>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{scoreData.summary}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>Score Progress</span>
                  <span>{scorePercent}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-500" style={{ width: `${scorePercent}%` }} />
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p>Model Version: <strong>{scoreData.modelVersion}</strong></p>
                  <p>Behavior Adjustment: <strong>{scoreData.behavioralAdjustment}</strong></p>
                </div>
              </div>
            </div>
          </section>

          <section className="card mt-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Component Scores</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Weighted components used to compute the final 0-900 trust score.
            </p>

            <div className="mt-4 h-[320px]">
              {barData ? (
                <Bar
                  data={barData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "top" } },
                    scales: { y: { beginAtZero: true, max: 100 } },
                  }}
                />
              ) : null}
            </div>

            <div className="mt-6 space-y-3">
              {(scoreData.componentBreakdown || []).map((component) => (
                <div key={component.name} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{component.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{component.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{component.rawScore}/100</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Weight: {component.weightPercent}%</p>
                    </div>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${component.rawScore}%` }} />
                  </div>

                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Contribution in model: {component.contributionToModel}%
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="card mt-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Recommended Next Actions</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Actions generated by the behavior model to improve your score faster.</p>

            {recommendations.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {recommendations.slice(0, 4).map((rec) => (
                  <div key={rec.code} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{rec.title}</p>
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                        {rec.potentialScoreImpact}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Priority: {rec.priority}</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{rec.action}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No recommendations available.</p>
            )}
          </section>
        </>
      ) : null}
    </Layout>
  );
}
