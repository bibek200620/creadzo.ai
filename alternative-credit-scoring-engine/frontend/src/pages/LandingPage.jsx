import { Link } from "react-router-dom";
import Layout from "../components/Layout";

export default function LandingPage() {
  return (
    <Layout>
      <section className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="card relative overflow-hidden">
          <div className="absolute -top-16 -right-14 h-52 w-52 rounded-full bg-brand-100/60 blur-3xl dark:bg-brand-900/30" />
          <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-cyan-100/70 blur-3xl dark:bg-cyan-900/30" />

          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">Alternative Credit Intelligence</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-900 dark:text-slate-50 md:text-5xl">
              Credit scoring for underbanked users using real transaction behavior.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-300">
              Upload PDF/CSV bank statements, extract income and expense patterns, compute behavioral trust signals, and generate a transparent 0-900 Trust Score.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-primary">Create Account</Link>
              <Link to="/login" className="btn-secondary">Login</Link>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Model Inputs</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li>Income regularity + gig worker compatibility</li>
              <li>Savings consistency and minimum balance behavior</li>
              <li>EMI continuity + utility bill payment discipline</li>
              <li>Monthly inflow-outflow health and volatility</li>
            </ul>
          </div>

          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Dashboard Outputs</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li>Monthly income vs expenses charts</li>
              <li>Category-wise spending pie graph</li>
              <li>Trust Score component-level breakdown</li>
              <li>Behavioral risk narrative for lenders</li>
            </ul>
          </div>
        </div>
      </section>
    </Layout>
  );
}
