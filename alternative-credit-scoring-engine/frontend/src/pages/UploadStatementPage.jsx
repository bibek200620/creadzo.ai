import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api/client";

export default function UploadStatementPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setError("Please select a PDF or CSV file.");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("statement", file);

    try {
      const { data } = await api.post("/bank/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(data);
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <section className="mx-auto max-w-3xl">
        <div className="card">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Upload Bank Statement</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Upload statement in <strong>PDF or CSV</strong>. The engine extracts inflow/outflow, categorizes transactions, and recalculates your trust score.
          </p>

          <form onSubmit={handleUpload} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Statement file</span>
              <input
                type="file"
                accept=".pdf,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="input-field"
              />
            </label>

            {file ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Selected: <strong>{file.name}</strong>
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>
            ) : null}

            {result ? (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <p>
                  Upload successful. Trust Score: <strong>{result.score?.trustScore}</strong> ({result.score?.scoreBand}).
                </p>
                {(result.recommendations?.recommendations || []).length > 0 ? (
                  <p className="mt-1">
                    Top action: <strong>{result.recommendations.recommendations[0].title}</strong>
                  </p>
                ) : null}
                {(result.recommendations?.riskFlags || []).length > 0 ? (
                  <p className="mt-1">
                    Risk alerts: <strong>{result.recommendations.riskFlags.length}</strong>
                  </p>
                ) : null}
                <p className="mt-1">Redirecting to dashboard...</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
                {loading ? "Analyzing..." : "Upload and Analyze"}
              </button>
              <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
            </div>
          </form>
        </div>

        <div className="card mt-5">
          <h2 className="text-lg font-semibold">Parser detection rules</h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-slate-700 dark:text-slate-300">
            <li>Salary credits: <code>SALARY</code>, <code>PAYROLL</code></li>
            <li>Loan EMI: <code>EMI</code>, <code>NACH</code>, <code>ECS</code></li>
            <li>Utility bills: <code>BESCOM</code>, <code>WATER</code>, <code>GAS</code>, <code>RECHARGE</code></li>
            <li>Expense categories: Rent, Food, Bills, EMI, Transport, Shopping, etc.</li>
          </ul>
        </div>
      </section>
    </Layout>
  );
}
