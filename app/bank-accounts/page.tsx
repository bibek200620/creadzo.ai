"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { backendRequest, getToken } from "@/lib/backendClient";

interface BankAccount {
  id: string;
  bankName: string;
  maskedAccount: string;
  ifsc: string;
  accountType: string;
  status: string;
  createdAt: string | null;
  gradient: string;
}

const gradients = [
  "from-emerald-600 to-teal-800",
  "from-amber-600 to-orange-800",
  "from-violet-600 to-indigo-800",
  "from-rose-600 to-pink-800",
];

export default function BankAccountsPage() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/onboarding/sign-in");
      return;
    }

    let cancelled = false;

    const loadAccounts = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await backendRequest<{
          accounts: Array<Omit<BankAccount, "gradient">>;
        }>("/bank-accounts");

        if (!cancelled) {
          setAccounts(
            (response.accounts || []).map((acc, index) => ({
              ...acc,
              gradient: gradients[index % gradients.length],
            })),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load linked accounts.";
          setError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadAccounts();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLinkAccount = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await backendRequest<{ account: Omit<BankAccount, "gradient"> }>("/bank-accounts", {
        method: "POST",
        body: {
          bankName,
          accountNumber,
          ifsc,
          accountType: "SAVINGS",
        },
      });

      setAccounts((prev) => [
        {
          ...response.account,
          gradient: gradients[prev.length % gradients.length],
        },
        ...prev,
      ]);

      setBankName("");
      setAccountNumber("");
      setIfsc("");
      setShowForm(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to link account.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelAddAccount = () => {
    setShowForm(false);
    setBankName("");
    setAccountNumber("");
    setIfsc("");
    setError("");
  };

  return (
    <div className="bg-stone-50 font-sans min-h-screen pb-12">
      <Navbar showBack />

      <main className="max-w-3xl mx-auto p-6 mt-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-stone-800">Linked Accounts</h2>
            <p className="text-stone-500 text-sm">Manage your bank connections</p>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">Loading linked accounts...</div>
        ) : (
          <div className="space-y-4">
            {accounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
                <p className="text-stone-700 font-semibold">No linked account yet</p>
                <p className="text-sm text-stone-500 mt-1">Add your first bank account to improve analysis quality.</p>
              </div>
            ) : null}

            {accounts.map((acc, i) => (
              <div key={acc.id || i} className={`bg-gradient-to-br ${acc.gradient} rounded-2xl p-6 text-white shadow-lg relative overflow-hidden`}>
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-white/60 text-xs font-medium uppercase tracking-wide">Linked Account</p>
                      <p className="text-xl font-bold mt-1">{acc.bankName}</p>
                    </div>
                    <div className="bg-white/10 p-2 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21" />
                      </svg>
                    </div>
                  </div>
                  <span className="font-mono text-lg tracking-widest text-white/80">{acc.maskedAccount}</span>
                  <p className="mt-2 text-xs text-white/60">IFSC: {acc.ifsc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full mt-6 bg-white hover:bg-teal-50 text-teal-700 font-semibold py-4 rounded-2xl border-2 border-dashed border-teal-200 transition-all flex items-center justify-center gap-2 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 group-hover:scale-110 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Another Bank Account
          </button>
        )}

        {showForm && (
          <div className="mt-6 bg-white p-8 rounded-2xl shadow-sm border border-stone-200/60">
            <h3 className="text-lg font-bold text-stone-800 mb-6">Link New Account</h3>
            <form onSubmit={handleLinkAccount} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1.5">Bank Name</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-stone-50/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1.5">Account Number</label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Enter account number"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-stone-50/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1.5">IFSC Code</label>
                <input
                  type="text"
                  required
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-stone-50/50 uppercase"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={cancelAddAccount} className="w-1/3 bg-stone-100 text-stone-600 font-semibold py-3 rounded-xl hover:bg-stone-200 transition">
                  Cancel
                </button>
                <button disabled={isSubmitting} type="submit" className="w-2/3 bg-teal-700 text-white font-semibold py-3 rounded-xl hover:bg-teal-800 transition shadow-md shadow-teal-700/15 disabled:opacity-60">
                  {isSubmitting ? "Linking..." : "Securely Link Account"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
