"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { backendRequest, setAuthSession, type BackendUser } from "@/lib/backendClient";

export default function SignInPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const data = await backendRequest<{ token: string; user: BackendUser }>("/auth/login", {
                method: "POST",
                body: { email, password },
            });

            setAuthSession(data.token, data.user);
            setIsLoading(false);
            router.push("/");
        } catch (loginError) {
            const message = loginError instanceof Error ? loginError.message : "Login failed. Please try again.";
            setError(message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen px-4 py-8 md:py-12">
            <div className="mx-auto w-full max-w-5xl">
                <div className="grid overflow-hidden rounded-[28px] border border-white/80 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl md:grid-cols-[0.95fr_1.1fr]">
                    <aside className="relative hidden p-8 md:block md:p-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
                        <div className="absolute -right-16 top-6 h-48 w-48 rounded-full bg-teal-400/20 blur-3xl" />
                        <div className="absolute -bottom-20 left-0 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" />

                        <div className="relative z-10">
                            <Link href="/" className="inline-flex items-center gap-2">
                                <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-500 font-bold text-slate-900">CZ</span>
                                <span className="text-sm uppercase tracking-[0.2em] text-teal-100">Credzo</span>
                            </Link>

                            <h1 className="mt-8 text-3xl font-bold leading-tight">Simple access to your trust-first credit profile.</h1>
                            <p className="mt-3 text-sm text-slate-300">
                                Sign in to check your score, manage linked accounts, and continue where you left off.
                            </p>

                            <div className="mt-8 space-y-3">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">Faster limit updates after each analysis</div>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">Single dashboard for score and loan offers</div>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">Designed for first-time borrowers</div>
                            </div>
                        </div>
                    </aside>

                    <section className="p-6 sm:p-8 md:p-10">
                        <Link href="/" className="inline-flex items-center gap-2 md:hidden">
                            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-sm font-bold text-white">CZ</span>
                            <span className="text-sm font-semibold text-slate-700">Credzo</span>
                        </Link>

                        <h2 className="mt-4 text-3xl font-bold text-slate-900">Welcome back</h2>
                        <p className="mt-1 text-sm text-slate-600">Log in to continue managing your financial identity.</p>

                        <form onSubmit={handleLogin} className="mt-7 space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="input-field"
                                    required
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        className="input-field pr-11"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 hover:text-slate-700"
                                        aria-label="Toggle password visibility"
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-4 w-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.584 10.587a2 2 0 102.829 2.828M9.88 4.622A10.96 10.96 0 0112 4.5c5.523 0 10 3.582 10 8 0 1.765-.712 3.396-1.913 4.734M6.228 6.228C3.638 7.602 2 9.89 2 12.5c0 4.418 4.477 8 10 8 1.999 0 3.861-.467 5.422-1.272" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-4 w-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7S3.732 16.057 2.458 12z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-primary w-full py-3 text-base disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isLoading ? "Signing in..." : "Sign In"}
                            </button>

                            {error ? (
                                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {error}
                                </p>
                            ) : null}

                            <p className="text-center text-sm text-slate-600">
                                New to Credzo?{" "}
                                <Link href="/onboarding/sign-up" className="font-semibold text-teal-700 hover:text-teal-800">
                                    Create account
                                </Link>
                            </p>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
}
