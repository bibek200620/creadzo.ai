import { cert, getApps, initializeApp } from "firebase-admin/app";
import type { App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type FirebaseServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

let cachedApp: App | null = null;

function parseServiceAccount(): FirebaseServiceAccount {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Record<string, string>;
      const projectId = parsed.project_id || parsed.projectId || "";
      const clientEmail = parsed.client_email || parsed.clientEmail || "";
      const privateKey = (parsed.private_key || parsed.privateKey || "").replace(/\\n/g, "\n");

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing required fields");
      }

      return {
        projectId,
        clientEmail,
        privateKey,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON";
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_KEY: ${message}`);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

export function getFirebaseWebApiKey(): string {
  const apiKey = process.env.FIREBASE_WEB_API_KEY || "";
  if (!apiKey) {
    throw new Error("Missing FIREBASE_WEB_API_KEY in environment.");
  }
  return apiKey;
}

export function getFirebaseAdminApp(): App {
  if (cachedApp) return cachedApp;
  const existingApp = getApps()[0];
  if (existingApp) {
    cachedApp = existingApp;
    return existingApp;
  }

  const serviceAccount = parseServiceAccount();
  cachedApp = initializeApp({
    credential: cert(serviceAccount),
  });
  return cachedApp;
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
