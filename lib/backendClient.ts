"use client";

export interface BackendUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "USER" | "ADMIN";
  dob?: string | null;
  currentAddress?: string;
  permanentAddress?: string;
  pan?: string;
  aadhaar?: string;
  employmentType?: string;
  monthlyIncome?: number;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

type BackendRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
};

const TOKEN_KEY = "credzoToken";
const USER_KEY = "credzoUser";

export function getBackendBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getStoredUser(): BackendUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BackendUser;
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, user: BackendUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateStoredUser(user: BackendUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function backendRequest<T>(path: string, options: BackendRequestOptions = {}): Promise<T> {
  const token = options.token || getToken();
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = (payload && typeof payload.message === "string" && payload.message)
      || (payload && typeof payload.error === "string" && payload.error)
      || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}
