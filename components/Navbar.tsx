"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NavbarProps {
    showBack?: boolean;
}

export default function Navbar({ showBack = false }: NavbarProps) {
    const router = useRouter();
    const [user, setUser] = useState<{ name: string } | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const storedUser = localStorage.getItem("credzoUser");
        if (!storedUser) return;

        try {
            const parsed = JSON.parse(storedUser);
            if (parsed && typeof parsed.name === "string") {
                setUser({ name: parsed.name });
            }
        } catch {
            // Ignore corrupted localStorage data
        }
    }, []);

    const initials = user?.name
        ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : "UN";
    const firstName = user?.name ? user.name.split(" ")[0] : "";

    return (
        <nav className="sticky top-0 z-30 px-4 pt-4">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl md:px-5">
                <div className="flex items-center gap-3">
                    {showBack && (
                        <button
                            onClick={() => router.push("/")}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-teal-200 hover:text-teal-700"
                            aria-label="Go back"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </button>
                    )}

                    <Link href="/" className="group flex items-center gap-2.5">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 text-white shadow-[0_8px_16px_rgba(15,118,110,0.35)]">
                            <span className="text-sm font-extrabold">CZ</span>
                        </div>
                        <div>
                            <p className="text-lg font-bold text-slate-900 leading-tight">Credzo</p>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Trust Engine</p>
                        </div>
                    </Link>
                </div>

                {mounted ? (
                    user ? (
                        <Link href="/profile" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-2 py-1.5 hover:border-teal-200 hover:bg-teal-50/50">
                            <div className="hidden text-right sm:block">
                                <p className="text-sm font-semibold text-slate-800">{firstName}</p>
                                <p className="text-xs text-slate-500">Profile</p>
                            </div>
                            <div className="grid h-10 w-10 place-items-center rounded-xl border border-teal-100 bg-teal-50 font-bold text-teal-700">
                                {initials}
                            </div>
                        </Link>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link href="/onboarding/sign-in" className="btn-secondary text-sm px-3 py-2">
                                Log In
                            </Link>
                            <Link href="/onboarding/sign-up" className="btn-primary text-sm px-3 py-2">
                                Create Account
                            </Link>
                        </div>
                    )
                ) : (
                    <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200/70" />
                )}
            </div>
        </nav>
    );
}
