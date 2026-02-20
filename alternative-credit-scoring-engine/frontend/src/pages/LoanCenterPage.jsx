import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString();
}

function getStatusTone(status) {
  if (status === "PENDING") return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-900";
  if (status === "ACTIVE") return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-900";
  if (status === "APPROVED") return "text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-900/20 dark:border-teal-900";
  if (status === "CLOSED") return "text-slate-700 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-900/50 dark:border-slate-800";
  return "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/20 dark:border-red-900";
}

export default function LoanCenterPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offersPayload, setOffersPayload] = useState(null);
  const [loans, setLoans] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState({ type: "", id: "" });
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    amount: 5000,
    tenureMonths: 6,
    purpose: "Working Capital",
  });

  const fetchLoanData = async () => {
    setLoading(true);
    setError("");
    if (isAdmin) {
      setOffersPayload(null);
    } else {
      setPendingApprovals([]);
    }

    const [loansResult, offersResult, queueResult] = await Promise.allSettled([
      api.get("/loan/my-loans"),
      isAdmin ? Promise.resolve(null) : api.get("/loan/offers"),
      isAdmin ? api.get("/loan/admin/pending?status=PENDING") : Promise.resolve(null),
    ]);

    if (loansResult.status === "fulfilled") {
      const loanList = loansResult.value.data?.loans || [];
      setLoans(loanList);
      setSelectedLoan((previous) => {
        if (loanList.length === 0) return null;
        if (!previous) return loanList[0];
        return loanList.find((loan) => loan.id === previous.id) || loanList[0];
      });
    } else {
      setLoans([]);
    }

    if (!isAdmin) {
      if (offersResult.status === "fulfilled") {
        const data = offersResult.value.data;
        setOffersPayload(data);

        const maxEligibleAmount = data?.offers?.maxEligibleAmount || 5000;
        const maxTenureMonths = data?.offers?.maxTenureMonths || 6;

        setForm((prev) => ({
          ...prev,
          amount: Math.min(Math.max(prev.amount, 5000), Math.max(maxEligibleAmount, 5000)),
          tenureMonths: Math.min(Math.max(prev.tenureMonths, 3), Math.max(maxTenureMonths, 3)),
        }));
      } else {
        setOffersPayload(null);
        setError(offersResult.reason?.response?.data?.message || "Failed to fetch loan offers");
      }
    }

    if (isAdmin) {
      if (queueResult.status === "fulfilled") {
        const queueLoans = queueResult.value.data?.loans || [];
        setPendingApprovals(queueLoans);
      } else {
        setPendingApprovals([]);
        setError(queueResult.reason?.response?.data?.message || "Failed to load loan approval queue");
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLoanData();
  }, [isAdmin]);

  const maxEligibleAmount = offersPayload?.offers?.maxEligibleAmount || 5000;
  const maxTenureMonths = offersPayload?.offers?.maxTenureMonths || 6;
  const canApply = !isAdmin && Boolean(offersPayload?.offers?.eligible);
  const ineligibleReason = offersPayload?.offers && !offersPayload?.offers?.eligible
    ? offersPayload.offers.reason
    : "";

  const tenureOptions = useMemo(() => {
    const maxTenure = Math.max(3, maxTenureMonths);
    const base = [3, 6, 9, 12, 15, 18, 24];
    return base.filter((item) => item <= maxTenure);
  }, [maxTenureMonths]);

  const handleApply = async (event) => {
    event.preventDefault();

    if (!canApply) {
      setError(ineligibleReason || "Loan is not eligible for approval right now.");
      return;
    }

    setSubmitting(true);
    setSuccessMessage("");
    setError("");

    try {
      const payload = {
        amount: Number(form.amount),
        tenureMonths: Number(form.tenureMonths),
        purpose: form.purpose,
      };

      const { data } = await api.post("/loan/apply", payload);
      setSuccessMessage(data.message || "Loan application submitted.");
      await fetchLoanData();

      if (data.loan) {
        setSelectedLoan(data.loan);
      }
    } catch (err) {
      const existingLoan = err.response?.data?.existingLoan;
      if (existingLoan) {
        setSelectedLoan(existingLoan);
      }
      setError(err.response?.data?.message || "Failed to submit loan request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewLoan = async (loan, action) => {
    setActionLoading({ type: action, id: loan.id });
    setSuccessMessage("");
    setError("");

    try {
      const note = window.prompt(`Optional note for ${action.toLowerCase()} decision:`, "") || "";

      const payload = {
        action,
        note,
      };

      if (action === "APPROVE") {
        const amountInput = window.prompt("Approved amount", String(loan.approvedAmount || loan.requestedAmount || 5000));
        const tenureInput = window.prompt("Approved tenure (months)", String(loan.tenureMonths || 6));
        const rateInput = window.prompt("Annual interest rate (%)", String(loan.annualInterestRate || 24));

        if (amountInput === null || tenureInput === null || rateInput === null) {
          setActionLoading({ type: "", id: "" });
          return;
        }

        payload.approvedAmount = Number(amountInput);
        payload.tenureMonths = Number(tenureInput);
        payload.annualInterestRate = Number(rateInput);
      }

      const { data } = await api.post(`/loan/admin/${loan.id}/decision`, payload);
      setSuccessMessage(data.message || "Loan review completed.");
      await fetchLoanData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to review loan");
    } finally {
      setActionLoading({ type: "", id: "" });
    }
  };

  const handleDisburse = async (loanId) => {
    setActionLoading({ type: "disburse", id: loanId });
    setSuccessMessage("");
    setError("");

    try {
      const { data } = await api.post(`/loan/${loanId}/disburse`);
      setSuccessMessage(data.message || "Loan disbursed.");
      await fetchLoanData();
      setSelectedLoan(data.loan || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to disburse loan");
    } finally {
      setActionLoading({ type: "", id: "" });
    }
  };

  const handleViewLoan = async (loanId) => {
    setActionLoading({ type: "view", id: loanId });
    setError("");

    try {
      const { data } = await api.get(`/loan/${loanId}`);
      setSelectedLoan(data.loan || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch loan details");
    } finally {
      setActionLoading({ type: "", id: "" });
    }
  };

  const handlePay = async (loan) => {
    const defaultAmount = Math.max(loan?.repaymentSummary?.nextInstallmentAmount || loan.emi || 0, 1000);
    const input = window.prompt(`Enter repayment amount for loan ${loan.id}:`, `${defaultAmount}`);
    if (!input) return;

    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Invalid payment amount.");
      return;
    }

    setActionLoading({ type: "pay", id: loan.id });
    setSuccessMessage("");
    setError("");

    try {
      const { data } = await api.post(`/loan/${loan.id}/pay`, {
        amount,
        method: "UPI",
      });

      setSuccessMessage(`${data.message}. Applied ${formatCurrency(data.appliedAmount)}.`);
      await fetchLoanData();
      setSelectedLoan(data.loan || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process payment");
    } finally {
      setActionLoading({ type: "", id: "" });
    }
  };

  const handlePayNextEmi = async (loan) => {
    setActionLoading({ type: "pay-emi", id: loan.id });
    setSuccessMessage("");
    setError("");

    try {
      const { data } = await api.post(`/loan/${loan.id}/pay-emi`, { method: "UPI" });
      setSuccessMessage(`${data.message}. Applied ${formatCurrency(data.appliedAmount)}.`);
      await fetchLoanData();
      setSelectedLoan(data.loan || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to pay next EMI");
    } finally {
      setActionLoading({ type: "", id: "" });
    }
  };

  const handlePayFull = async (loan) => {
    const ok = window.confirm(`Pay full outstanding amount ${formatCurrency(loan.remainingAmount)}?`);
    if (!ok) return;

    setActionLoading({ type: "pay-full", id: loan.id });
    setSuccessMessage("");
    setError("");

    try {
      const { data } = await api.post(`/loan/${loan.id}/pay-full`, { method: "UPI" });
      setSuccessMessage(`${data.message}. Applied ${formatCurrency(data.appliedAmount)}.`);
      await fetchLoanData();
      setSelectedLoan(data.loan || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to close loan repayment");
    } finally {
      setActionLoading({ type: "", id: "" });
    }
  };

  return (
    <Layout>
      <section className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Loan Center</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">
          {isAdmin ? "Loan Approver Console" : "Apply, Disburse, and Repay"}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {isAdmin
            ? "Review pending loan applications and approve or reject with final terms."
            : "Eligibility, application, disbursement, and repayment in one flow."}
        </p>
      </section>

      {loading ? <div className="card"><p className="text-sm">Loading loan data...</p></div> : null}
      {!loading && error ? <div className="mb-4 card"><p className="text-sm text-red-700 dark:text-red-300">{error}</p></div> : null}
      {!loading && successMessage ? <div className="mb-4 card"><p className="text-sm text-emerald-700 dark:text-emerald-300">{successMessage}</p></div> : null}

      {!loading && isAdmin ? (
        <section className="mb-6 card overflow-x-auto">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Pending Loan Applications</h2>

          {pendingApprovals.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No pending applications for approval.</p>
          ) : (
            <table className="mt-4 min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-2 pr-3 font-medium">Applicant</th>
                  <th className="pb-2 pr-3 font-medium">Request</th>
                  <th className="pb-2 pr-3 font-medium">Proposed Terms</th>
                  <th className="pb-2 pr-3 font-medium">Applied</th>
                  <th className="pb-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.map((loan) => (
                  <tr key={loan.id} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{loan.applicant?.name || "--"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{loan.applicant?.email || "--"}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <p>{formatCurrency(loan.requestedAmount)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{loan.tenureMonths} months</p>
                    </td>
                    <td className="py-2 pr-3">
                      <p>{formatCurrency(loan.approvedAmount)} • {loan.annualInterestRate}%</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">EMI {formatCurrency(loan.emi)}</p>
                    </td>
                    <td className="py-2 pr-3">{formatDate(loan.appliedAt)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-teal-300 px-2 py-1 text-xs font-medium text-teal-700 hover:border-teal-500 dark:border-teal-900 dark:text-teal-300"
                          onClick={() => handleReviewLoan(loan, "APPROVE")}
                          disabled={actionLoading.id === loan.id && actionLoading.type === "APPROVE"}
                        >
                          {actionLoading.id === loan.id && actionLoading.type === "APPROVE" ? "Approving..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:border-red-500 dark:border-red-900 dark:text-red-300"
                          onClick={() => handleReviewLoan(loan, "REJECT")}
                          disabled={actionLoading.id === loan.id && actionLoading.type === "REJECT"}
                        >
                          {actionLoading.id === loan.id && actionLoading.type === "REJECT" ? "Rejecting..." : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {!loading && !isAdmin ? (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Eligibility Snapshot</h2>

            {offersPayload?.offers ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Trust Score</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{offersPayload.offers.trustScore}/900</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{offersPayload.offers.scoreBand} • {offersPayload.offers.tier}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Max Eligible</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(offersPayload.offers.maxEligibleAmount)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Up to {offersPayload.offers.maxTenureMonths} months</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Interest Rate</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{offersPayload.offers.annualInterestRate}%</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Annual reducing rate</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Repayment Capacity</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(offersPayload.offers.repaymentCapacity)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Estimated safe monthly EMI</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No eligibility data available.</p>
            )}

            {ineligibleReason ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                <p className="font-semibold">Not eligible right now</p>
                <p className="mt-1">{ineligibleReason}</p>
                <Link to="/score" className="mt-2 inline-block text-xs font-semibold underline underline-offset-4">
                  View score factors to improve eligibility
                </Link>
              </div>
            ) : null}

            {canApply && (offersPayload?.offers?.recommendedOffers || []).length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recommended Offers</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {offersPayload.offers.recommendedOffers.slice(0, 4).map((offer, index) => (
                    <button
                      key={`${offer.amount}-${offer.tenureMonths}-${index}`}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, amount: offer.amount, tenureMonths: offer.tenureMonths }))}
                      className="rounded-xl border border-slate-200 p-3 text-left hover:border-brand-500 dark:border-slate-800"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(offer.amount)} • {offer.tenureMonths} months</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">EMI {formatCurrency(offer.estimatedEmi)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Apply for Loan</h2>

            <form className="mt-4 space-y-4" onSubmit={handleApply}>
              <div>
                <label className="mb-1 block text-sm font-medium">Amount</label>
                <input
                  type="number"
                  min={5000}
                  max={Math.max(maxEligibleAmount, 5000)}
                  step={500}
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                  className="input-field"
                  disabled={!canApply}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Max allowed: {formatCurrency(maxEligibleAmount)}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Tenure (months)</label>
                <select
                  value={form.tenureMonths}
                  onChange={(e) => setForm((prev) => ({ ...prev, tenureMonths: Number(e.target.value) }))}
                  className="input-field"
                  disabled={!canApply}
                >
                  {tenureOptions.map((option) => (
                    <option key={option} value={option}>{option} months</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Purpose</label>
                <select
                  value={form.purpose}
                  onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))}
                  className="input-field"
                  disabled={!canApply}
                >
                  <option value="Working Capital">Working Capital</option>
                  <option value="Inventory Purchase">Inventory Purchase</option>
                  <option value="Education">Education</option>
                  <option value="Medical">Medical</option>
                  <option value="Home Needs">Home Needs</option>
                  <option value="Debt Consolidation">Debt Consolidation</option>
                </select>
              </div>

              <button type="submit" className="btn-primary w-full disabled:opacity-60" disabled={!canApply || submitting}>
                {!canApply ? "Not Eligible for Loan" : submitting ? "Submitting..." : "Submit Loan Application"}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {!loading ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          <div className="card overflow-x-auto">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">My Loans</h2>

            {loans.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No loan records yet.</p>
            ) : (
              <table className="mt-4 min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-3 font-medium">Applied</th>
                    <th className="pb-2 pr-3 font-medium">Amount</th>
                    <th className="pb-2 pr-3 font-medium">EMI</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => (
                    <tr key={loan.id} className="border-b border-slate-100 dark:border-slate-900">
                      <td className="py-2 pr-3">{formatDate(loan.appliedAt)}</td>
                      <td className="py-2 pr-3">{formatCurrency(loan.approvedAmount || loan.requestedAmount)}</td>
                      <td className="py-2 pr-3">{loan.emi ? formatCurrency(loan.emi) : "--"}</td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusTone(loan.status)}`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:border-brand-500 dark:border-slate-700"
                            onClick={() => handleViewLoan(loan.id)}
                            disabled={actionLoading.type === "view" && actionLoading.id === loan.id}
                          >
                            {actionLoading.type === "view" && actionLoading.id === loan.id ? "Loading..." : "View"}
                          </button>

                          {loan.status === "APPROVED" ? (
                            <button
                              type="button"
                              className="rounded-lg border border-teal-300 px-2 py-1 text-xs font-medium text-teal-700 hover:border-teal-500 dark:border-teal-900 dark:text-teal-300"
                              onClick={() => handleDisburse(loan.id)}
                              disabled={actionLoading.type === "disburse" && actionLoading.id === loan.id}
                            >
                              {actionLoading.type === "disburse" && actionLoading.id === loan.id ? "Disbursing..." : "Disburse"}
                            </button>
                          ) : null}

                          {loan.status === "ACTIVE" ? (
                            <button
                              type="button"
                              className="rounded-lg border border-brand-300 px-2 py-1 text-xs font-medium text-brand-700 hover:border-brand-500 dark:border-brand-900 dark:text-brand-300"
                              onClick={() => handlePayNextEmi(loan)}
                              disabled={actionLoading.type === "pay-emi" && actionLoading.id === loan.id}
                            >
                              {actionLoading.type === "pay-emi" && actionLoading.id === loan.id ? "Paying..." : "Pay EMI"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Loan Detail</h2>

            {selectedLoan ? (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Status</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{selectedLoan.status}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Approved Amount</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(selectedLoan.approvedAmount || 0)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Tenure & EMI</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{selectedLoan.tenureMonths || 0} months • {formatCurrency(selectedLoan.emi || 0)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Outstanding</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(selectedLoan.remainingAmount || 0)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Next Due</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatDate(selectedLoan.nextDueDate)}</p>
                </div>

                {selectedLoan?.repaymentSummary ? (
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Repayment Summary</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                      Paid Installments: <strong>{selectedLoan.repaymentSummary.paidInstallments}</strong> / {selectedLoan.repaymentSummary.totalInstallments}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      Next EMI: <strong>{formatCurrency(selectedLoan.repaymentSummary.nextInstallmentAmount)}</strong>
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      Due Now: <strong>{formatCurrency(selectedLoan.repaymentSummary.dueNowAmount)}</strong>
                    </p>
                  </div>
                ) : null}

                {selectedLoan.status === "ACTIVE" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-brand-300 px-2 py-1 text-xs font-medium text-brand-700 hover:border-brand-500 dark:border-brand-900 dark:text-brand-300"
                      onClick={() => handlePayNextEmi(selectedLoan)}
                      disabled={actionLoading.type === "pay-emi" && actionLoading.id === selectedLoan.id}
                    >
                      {actionLoading.type === "pay-emi" && actionLoading.id === selectedLoan.id ? "Paying EMI..." : "Pay Next EMI"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-teal-300 px-2 py-1 text-xs font-medium text-teal-700 hover:border-teal-500 dark:border-teal-900 dark:text-teal-300"
                      onClick={() => handlePayFull(selectedLoan)}
                      disabled={actionLoading.type === "pay-full" && actionLoading.id === selectedLoan.id}
                    >
                      {actionLoading.type === "pay-full" && actionLoading.id === selectedLoan.id ? "Closing..." : "Pay Full"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:border-brand-500 dark:border-slate-700"
                      onClick={() => handlePay(selectedLoan)}
                      disabled={actionLoading.type === "pay" && actionLoading.id === selectedLoan.id}
                    >
                      {actionLoading.type === "pay" && actionLoading.id === selectedLoan.id ? "Paying..." : "Custom Pay"}
                    </button>
                  </div>
                ) : null}

                {(selectedLoan.schedule || []).length > 0 ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Repayment Schedule</p>
                    <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800">
                            <th className="px-2 py-2 text-left">#</th>
                            <th className="px-2 py-2 text-left">Due</th>
                            <th className="px-2 py-2 text-left">EMI</th>
                            <th className="px-2 py-2 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedLoan.schedule.map((item) => (
                            <tr key={`${selectedLoan.id}-${item.installmentNumber}`} className="border-b border-slate-100 dark:border-slate-900">
                              <td className="px-2 py-1.5">{item.installmentNumber}</td>
                              <td className="px-2 py-1.5">{formatDate(item.dueDate)}</td>
                              <td className="px-2 py-1.5">{formatCurrency(item.emiAmount)}</td>
                              <td className="px-2 py-1.5">{item.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Select a loan to view detailed status.</p>
            )}
          </div>
        </section>
      ) : null}
    </Layout>
  );
}
