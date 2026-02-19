import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getFirebaseWebApiKey } from "@/lib/server/firebaseAdmin";
import { jsonError, parseOptionalString, safeErrorMessage } from "@/lib/server/api";
import { mapProfileToBackendUser, profileRef, type ProfileDoc } from "@/lib/server/store";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function mapFirebaseLoginError(message: string): string {
  if (message.includes("INVALID_LOGIN_CREDENTIALS")) return "Invalid email or password.";
  if (message.includes("EMAIL_NOT_FOUND")) return "Invalid email or password.";
  if (message.includes("INVALID_PASSWORD")) return "Invalid email or password.";
  if (message.includes("USER_DISABLED")) return "Your account is disabled.";
  return "Login failed. Please try again.";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoginBody;
    const email = parseOptionalString(body.email).toLowerCase();
    const password = parseOptionalString(body.password);

    if (!email || !password) {
      return jsonError("Email and password are required.", 400);
    }

    const apiKey = getFirebaseWebApiKey();
    const loginResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      },
    );

    const loginData = (await loginResponse.json()) as {
      idToken?: string;
      localId?: string;
      email?: string;
      error?: { message?: string };
    };

    if (!loginResponse.ok || !loginData.localId || !loginData.idToken) {
      return jsonError(mapFirebaseLoginError(loginData?.error?.message || ""), 401);
    }

    const uid = loginData.localId;
    const nowMs = Date.now();
    const profileSnapshot = await profileRef(uid).get();

    let profileData: ProfileDoc;
    if (profileSnapshot.exists) {
      const existing = profileSnapshot.data() as Partial<ProfileDoc>;
      profileData = {
        name: existing.name || "User",
        email: existing.email || loginData.email || email,
        phone: existing.phone || "",
        role: existing.role || "USER",
        dob: existing.dob || "",
        currentAddress: existing.currentAddress || "",
        permanentAddress: existing.permanentAddress || "",
        pan: existing.pan || "",
        aadhaar: existing.aadhaar || "",
        employmentType: existing.employmentType || "",
        monthlyIncome: Number(existing.monthlyIncome || 0),
        lastLoginAtMs: nowMs,
        createdAtMs: Number(existing.createdAtMs || nowMs),
        updatedAtMs: nowMs,
      };
    } else {
      const authUser = await getAdminAuth().getUser(uid);
      profileData = {
        name: authUser.displayName || "User",
        email: authUser.email || email,
        phone: authUser.phoneNumber || "",
        role: "USER",
        dob: "",
        currentAddress: "",
        permanentAddress: "",
        pan: "",
        aadhaar: "",
        employmentType: "",
        monthlyIncome: 0,
        lastLoginAtMs: nowMs,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      };
    }

    await profileRef(uid).set(profileData, { merge: true });

    return NextResponse.json({
      token: loginData.idToken,
      user: mapProfileToBackendUser(uid, profileData),
    });
  } catch (error) {
    return jsonError(safeErrorMessage(error, "Login failed."), 500);
  }
}
