import { createContext, useCallback, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

function normalizeUser(userValue) {
  if (!userValue) return null;
  return {
    ...userValue,
    role: userValue.role || "USER",
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("acse_token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("acse_user");
    if (!raw) return null;
    try {
      return normalizeUser(JSON.parse(raw));
    } catch {
      return null;
    }
  });

  const login = useCallback(({ token: authToken, user: authUser }) => {
    const normalizedUser = normalizeUser(authUser);
    localStorage.setItem("acse_token", authToken);
    localStorage.setItem("acse_user", JSON.stringify(normalizedUser));
    setToken(authToken);
    setUser(normalizedUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("acse_token");
    localStorage.removeItem("acse_user");
    setToken("");
    setUser(null);
  }, []);

  const updateUser = useCallback((newUser) => {
    const normalizedUser = normalizeUser(newUser);
    localStorage.setItem("acse_user", JSON.stringify(normalizedUser));
    setUser(normalizedUser);
  }, []);

  const value = useMemo(
    () => ({ token, user, isAuthenticated: Boolean(token), login, logout, updateUser }),
    [token, user, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
