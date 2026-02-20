import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import Layout from "../components/Layout";
import api from "../api/client";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

function formatDate(date) {
  if (!date) return "--";
  return new Date(date).toLocaleDateString();
}

function scoreTone(score) {
  if (score >= 780) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 680) return "text-teal-700 dark:text-teal-300";
  if (score >= 560) return "text-amber-700 dark:text-amber-300";
  return "text-red-700 dark:text-red-300";
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError("");

      try {
        const { data } = await api.get("/analytics/history?limit=24");
        setHistory(data.history || []);

        if (data.history?.[0]?.id) {
          setSelectedId(String(data.history[0].id));
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch statement history");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const { data } = await api.get(`/analytics/history/${selectedId}`);
        setSelectedDetail(data);
      } catch {
        setSelectedDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };

    fetchDetail();
  }, [selectedId]);

  const trendData = useMemo(() => {
    const sorted = [...history].reverse();
    return {
      labels: sorted.map((item) => formatDate(item.uploadedAt)),
      datasets: [
        {
          label: "Trust Score Trend",
          data: sorted.map((item) => item.trustScore),
          borderColor: "#0f766e",
          backgroundColor: "rgba(15,118,110,0.2)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    };
  }, [history]);

  return (
    <Layout>
      <section className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">History</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">Statement History & Score Trend</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Compare how your trust profile changes with each statement upload.
        </p>
      </section>

      {loading ? <div className="card"><p className="text-sm">Loading history...</p></div> : null}
      {!loading && error ? <div className="card"><p className="text-sm text-red-700 dark:text-red-300">{error}</p></div> : null}

      {!loading && !error && history.length > 0 ? (
        <>
          <section className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Trust Score Over Time</h2>
            <div className="mt-4 h-[300px]">
              <Line
                data={trendData}
                options={{
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true, max: 900 } },
                  plugins: { legend: { position: "top" } },
                }}
              />
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            <div className="card overflow-x-auto">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Uploads</h2>
              <table className="mt-4 min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 font-medium">File</th>
                    <th className="pb-2 pr-3 font-medium">Trust Score</th>
                    <th className="pb-2 pr-3 font-medium">Band</th>
                    <th className="pb-2 pr-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-900">
                      <td className="py-2 pr-3">{formatDate(item.uploadedAt)}</td>
                      <td className="py-2 pr-3">{item.fileName}</td>
                      <td className={`py-2 pr-3 font-semibold ${scoreTone(item.trustScore)}`}>{item.trustScore}/900</td>
                      <td className="py-2 pr-3">{item.scoreBand}</td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(String(item.id))}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:border-brand-500 dark:border-slate-700"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Statement Detail</h2>
              {detailLoading ? (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Loading details...</p>
              ) : selectedDetail ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">File</p>
                    <p className="font-semibold">{selectedDetail.statement?.fileName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Uploaded</p>
                    <p className="font-semibold">{formatDate(selectedDetail.statement?.uploadedAt)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Trust Score</p>
                    <p className={`text-2xl font-bold ${scoreTone(selectedDetail.score?.trustScore || 0)}`}>
                      {selectedDetail.score?.trustScore || 0}/900
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Summary</p>
                    <p>{selectedDetail.score?.summary || "--"}</p>
                  </div>

                  {(selectedDetail.recommendations?.recommendations || []).length > 0 ? (
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Top Recommendation</p>
                      <p className="font-semibold">{selectedDetail.recommendations.recommendations[0].title}</p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {selectedDetail.recommendations.recommendations[0].action}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Select a statement to view details.</p>
              )}
            </div>
          </section>
        </>
      ) : null}

      {!loading && !error && history.length === 0 ? (
        <div className="card"><p className="text-sm text-slate-600 dark:text-slate-300">No history yet. Upload your first statement.</p></div>
      ) : null}
    </Layout>
  );
}
