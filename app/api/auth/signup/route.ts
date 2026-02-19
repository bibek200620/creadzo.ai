import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getFirebaseWebApiKey } from "@/lib/server/firebaseAdmin";
import { isNonEmptyString, jsonError, parseOptionalString, safeErrorMessage } from "@/lib/server/api";
import { mapProfileToBackendUser, profileRef, type ProfileDoc } from "@/lib/server/store";

type SignupBody = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
  dob?: unknown;
  currentAddress?: unknown;
  permanentAddress?: unknown;
  pan?: unknown;
  aadhaar?: unknown;
  employmentType?: unknown;
  monthlyIncome?: unknown;
};

function parseSignupBody(body: SignupBody) {
  const name = parseOptionalString(body.name);
  const email = parseOptionalString(body.email).toLowerCase();
  const phone = parseOptionalString(body.phone);
  const password = parseOptionalString(body.password);
  const dob = parseOptionalString(body.dob);
  const currentAddress = parseOptionalString(body.currentAddress);
  const permanentAddress = parseOptionalString(body.permanentAddress);
  const pan = parseOptionalString(body.pan).toUpperCase();
  const aadhaar = parseOptionalString(body.aadhaar);
  const employmentType = parseOptionalString(body.employmentType);
  const monthlyIncome = Number(body.monthlyIncome || 0);

  if (!isNonEmptyString(name)) throw new Error("Name is required.");
  if (!isNonEmptyString(email) || !email.includes("@")) throw new Error("Valid email is required.");
  if (!isNonEmptyString(phone)) throw new Error("Phone is required.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  return {
    name,
    email,
    phone,
    password,
    dob,
    currentAddress,
    permanentAddress: permanentAddress || currentAddress,
    pan,
    aadhaar,
    employmentType,
    monthlyIncome: Number.isFinite(monthlyIncome) ? Math.max(0, monthlyIncome) : 0,
  };
}

function mapFirebaseErrorMessage(message: string): string {
  if (message.includes("EMAIL_EXISTS")) return "This email is already registered.";
  if (message.includes("WEAK_PASSWORD")) return "Please use a stronger password.";
  return "Signup failed. Please try again.";
}

export async function POST(req: NextRequest) {
  try {
    const payload = parseSignupBody((await req.json()) as SignupBody);
    const apiKey = getFirebaseWebApiKey();

    const signupResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          returnSecureToken: true,
        }),
      },
    );

    const signupData = (await signupResponse.json()) as {
      idToken?: string;
      localId?: string;
      error?: { message?: string };
    };

    if (!signupResponse.ok || !signupData.localId || !signupData.idToken) {
      const errorMessage = signupData?.error?.message || "Signup failed";
      return jsonError(mapFirebaseErrorMessage(errorMessage), 400);
    }

    const uid = signupData.localId;
    const nowMs = Date.now();
    const profile: ProfileDoc = {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      role: "USER",
      dob: payload.dob,
      currentAddress: payload.currentAddress,
      permanentAddress: payload.permanentAddress,
      pan: payload.pan,
      aadhaar: payload.aadhaar,
      employmentType: payload.employmentType,
      monthlyIncome: payload.monthlyIncome,
      lastLoginAtMs: nowMs,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    await profileRef(uid).set(profile, { merge: true });

    await getAdminAuth().updateUser(uid, {
      email: payload.email,
      displayName: payload.name,
    });

    return NextResponse.json({
      token: signupData.idToken,
      user: mapProfileToBackendUser(uid, profile),
    });
  } catch (error) {
    return jsonError(safeErrorMessage(error, "Signup failed."), 500);
  }
}
