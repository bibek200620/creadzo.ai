import { Link, NavLink, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const loanNavLabel = user?.role === "ADMIN" ? "Approvals" : "Loan";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link to={token ? "/dashboard" : "/"} className="text-lg font-bold text-slate-900 dark:text-slate-50">
          Alternative Credit Scoring Engine
        </Link>

        <div className="flex items-center gap-2 md:gap-3">
          {token ? (
            <>
              <nav className="hidden items-center gap-2 md:flex">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/upload"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`
                  }
                >
                  Upload
                </NavLink>
                <NavLink
                  to="/score"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`
                  }
                >
                  Score
                </NavLink>
                <NavLink
                  to="/loan"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`
                  }
                >
                  {loanNavLabel}
                </NavLink>
                <NavLink
                  to="/history"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`
                  }
                >
                  History
                </NavLink>
              </nav>

              <ThemeToggle />

              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="hidden rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200 md:block"
              >
                {user?.name || "Profile"}
              </button>

              <button type="button" onClick={handleLogout} className="btn-secondary text-sm">
                Logout
              </button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link to="/login" className="btn-secondary text-sm">Login</Link>
              <Link to="/signup" className="btn-primary text-sm">Signup</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
