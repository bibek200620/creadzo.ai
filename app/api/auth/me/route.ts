import { NextRequest, NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/server/auth";
import { getAdminAuth } from "@/lib/server/firebaseAdmin";
import { jsonError, parseOptionalString, safeErrorMessage } from "@/lib/server/api";
import { mapProfileToBackendUser, profileRef, type ProfileDoc } from "@/lib/server/store";

type UpdateMeBody = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  dob?: unknown;
  currentAddress?: unknown;
  permanentAddress?: unknown;
  pan?: unknown;
  aadhaar?: unknown;
  employmentType?: unknown;
  monthlyIncome?: unknown;
};

async function loadOrInitProfile(uid: string): Promise<ProfileDoc> {
  const snapshot = await profileRef(uid).get();
  if (snapshot.exists) {
    const data = snapshot.data() as Partial<ProfileDoc>;
    const nowMs = Date.now();
    return {
      name: data.name || "User",
      email: data.email || "",
      phone: data.phone || "",
      role: data.role || "USER",
      dob: data.dob || "",
      currentAddress: data.currentAddress || "",
      permanentAddress: data.permanentAddress || "",
      pan: data.pan || "",
      aadhaar: data.aadhaar || "",
      employmentType: data.employmentType || "",
      monthlyIncome: Number(data.monthlyIncome || 0),
      lastLoginAtMs: data.lastLoginAtMs ?? null,
      createdAtMs: Number(data.createdAtMs || nowMs),
      updatedAtMs: Number(data.updatedAtMs || nowMs),
    };
  }

  const authUser = await getAdminAuth().getUser(uid);
  const nowMs = Date.now();
  const profile: ProfileDoc = {
    name: authUser.displayName || "User",
    email: authUser.email || "",
    phone: authUser.phoneNumber || "",
    role: "USER",
    dob: "",
    currentAddress: "",
    permanentAddress: "",
    pan: "",
    aadhaar: "",
    employmentType: "",
    monthlyIncome: 0,
    lastLoginAtMs: null,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
  await profileRef(uid).set(profile, { merge: true });
  return profile;
}

export async function GET(req: NextRequest) {
  try {
    const uid = await requireUserId(req);
    const profile = await loadOrInitProfile(uid);
    return NextResponse.json({ user: mapProfileToBackendUser(uid, profile) });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401);
    }
    return jsonError(safeErrorMessage(error, "Failed to load profile."), 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const uid = await requireUserId(req);
    const body = (await req.json()) as UpdateMeBody;
    const existing = await loadOrInitProfile(uid);
    const nowMs = Date.now();

    const nextProfile: ProfileDoc = {
      ...existing,
      name: parseOptionalString(body.name) || existing.name,
      email: parseOptionalString(body.email).toLowerCase() || existing.email,
      phone: parseOptionalString(body.phone) || existing.phone,
      dob: parseOptionalString(body.dob),
      currentAddress: parseOptionalString(body.currentAddress),
      permanentAddress: parseOptionalString(body.permanentAddress),
      pan: parseOptionalString(body.pan).toUpperCase(),
      aadhaar: parseOptionalString(body.aadhaar),
      employmentType: parseOptionalString(body.employmentType),
      monthlyIncome: Math.max(0, Number(body.monthlyIncome || 0)),
      updatedAtMs: nowMs,
      lastLoginAtMs: existing.lastLoginAtMs,
      createdAtMs: existing.createdAtMs,
      role: existing.role,
    };

    await profileRef(uid).set(nextProfile, { merge: true });

    const authUpdates: { email?: string; displayName?: string } = {};
    if (nextProfile.email && nextProfile.email !== existing.email) {
      authUpdates.email = nextProfile.email;
    }
    if (nextProfile.name && nextProfile.name !== existing.name) {
      authUpdates.displayName = nextProfile.name;
    }
    if (authUpdates.email || authUpdates.displayName) {
      await getAdminAuth().updateUser(uid, authUpdates);
    }

    return NextResponse.json({ user: mapProfileToBackendUser(uid, nextProfile) });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401);
    }
    return jsonError(safeErrorMessage(error, "Failed to update profile."), 500);
  }
}
