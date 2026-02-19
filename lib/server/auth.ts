import { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/server/firebaseAdmin";

export class UnauthorizedError extends Error {}

function getBearerToken(req: NextRequest): string {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header.");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new UnauthorizedError("Missing bearer token.");
  }

  return token;
}

export async function requireUserId(req: NextRequest): Promise<string> {
  const token = getBearerToken(req);
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!decoded?.uid) {
      throw new UnauthorizedError("Invalid token.");
    }
    return decoded.uid;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError("Authentication failed. Please log in again.");
  }
}
