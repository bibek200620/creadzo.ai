import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);

      try {
        const [summaryResponse, historyResponse] = await Promise.allSettled([
          api.get("/analytics/summary"),
          api.get("/analytics/history?limit=100"),
        ]);

        if (historyResponse.status === "fulfilled") {
          setHistoryCount(historyResponse.value.data?.count || 0);
        } else {
          setHistoryCount(0);
        }

        if (summaryResponse.status !== "fulfilled") {
          setSummary(null);
          return;
        }

        const data = summaryResponse.value.data;
        setSummary(data);
        if (data.user) {
          updateUser(data.user);
        }
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [updateUser]);

  return (
    <Layout>
      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="card">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Profile</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Account and trust scoring identity details.</p>

          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Name</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{user?.name || "--"}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Email</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{user?.email || "--"}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Phone</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{user?.phone || "--"}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Role</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{user?.role || "USER"}</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Latest Analysis Snapshot</h2>

          {loading ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Loading summary...</p>
          ) : summary ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Trust Score</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{summary.score?.trustScore || 0}/900</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Score Band</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{summary.score?.scoreBand || "--"}</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Avg Monthly Income</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">₹{(summary.analytics?.metrics?.averageMonthlyIncome || 0).toLocaleString()}</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Avg Monthly Expense</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">₹{(summary.analytics?.metrics?.averageMonthlyExpenses || 0).toLocaleString()}</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Total Statements Uploaded</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{historyCount}</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No analysis uploaded yet.</p>
          )}
        </div>
      </section>
    </Layout>
  );
}
