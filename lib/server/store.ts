import { getAdminDb } from "@/lib/server/firebaseAdmin";

export type AppRole = "USER" | "ADMIN";

export type ProfileDoc = {
  name: string;
  email: string;
  phone: string;
  role: AppRole;
  dob: string;
  currentAddress: string;
  permanentAddress: string;
  pan: string;
  aadhaar: string;
  employmentType: string;
  monthlyIncome: number;
  lastLoginAtMs: number | null;
  createdAtMs: number;
  updatedAtMs: number;
};

export type BackendUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AppRole;
  dob?: string | null;
  currentAddress?: string;
  permanentAddress?: string;
  pan?: string;
  aadhaar?: string;
  employmentType?: string;
  monthlyIncome?: number;
  lastLoginAt?: string | null;
  createdAt?: string | null;
};

export function profileRef(uid: string) {
  return getAdminDb().collection("profiles").doc(uid);
}

export function analysisCollection(uid: string) {
  return profileRef(uid).collection("analysisRecords");
}

export function bankAccountsCollection(uid: string) {
  return profileRef(uid).collection("bankAccounts");
}

export function loansCollection(uid: string) {
  return profileRef(uid).collection("loans");
}

export function loanInstallmentsCollection(uid: string, loanId: string) {
  return loansCollection(uid).doc(loanId).collection("installments");
}

export function loanRepaymentsCollection(uid: string, loanId: string) {
  return loansCollection(uid).doc(loanId).collection("repayments");
}

export function mapProfileToBackendUser(uid: string, data: Partial<ProfileDoc>): BackendUser {
  return {
    id: uid,
    name: data.name || "User",
    email: data.email || "",
    phone: data.phone || "",
    role: data.role || "USER",
    dob: data.dob || null,
    currentAddress: data.currentAddress || "",
    permanentAddress: data.permanentAddress || "",
    pan: data.pan || "",
    aadhaar: data.aadhaar || "",
    employmentType: data.employmentType || "",
    monthlyIncome: Number(data.monthlyIncome || 0),
    lastLoginAt: data.lastLoginAtMs ? new Date(data.lastLoginAtMs).toISOString() : null,
    createdAt: data.createdAtMs ? new Date(data.createdAtMs).toISOString() : null,
  };
}

export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  const last4 = digits.slice(-4) || "0000";
  return `XXXX-XXXX-${last4}`;
}
