import { NextRequest, NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/server/auth";
import { jsonError, safeErrorMessage } from "@/lib/server/api";
import { analysisCollection } from "@/lib/server/store";

export async function GET(req: NextRequest) {
  try {
    const uid = await requireUserId(req);
    const snapshot = await analysisCollection(uid)
      .orderBy("analyzedAtMs", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return jsonError("No saved analysis found.", 404);
    }

    const doc = snapshot.docs[0];
    const data = doc.data() as {
      sourceFileName?: string;
      summary?: Record<string, unknown>;
      analysis?: Record<string, unknown>;
      analyzedAtMs?: number;
      expiresAtMs?: number;
    };

    const analyzedAtMs = Number(data.analyzedAtMs || 0);
    const expiresAtMs = Number(data.expiresAtMs || 0);
    const nowMs = Date.now();

    if (!analyzedAtMs || !expiresAtMs || nowMs >= expiresAtMs) {
      return jsonError("Analysis expired. Upload a new statement.", 404);
    }

    return NextResponse.json({
      record: {
        id: doc.id,
        sourceFileName: data.sourceFileName || "",
        summary: data.summary || {},
        analysis: data.analysis || null,
        analyzedAt: new Date(analyzedAtMs).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(error.message, 401);
    return jsonError(safeErrorMessage(error, "Failed to load analysis."), 500);
  }
}
