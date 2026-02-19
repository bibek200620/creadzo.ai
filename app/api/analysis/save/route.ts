import { NextRequest, NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/server/auth";
import { jsonError, parseOptionalString, safeErrorMessage } from "@/lib/server/api";
import { analysisCollection } from "@/lib/server/store";

const ANALYSIS_RETENTION_DAYS = 15;
const ANALYSIS_RETENTION_MS = ANALYSIS_RETENTION_DAYS * 24 * 60 * 60 * 1000;

type SaveAnalysisBody = {
  analysis?: unknown;
  sourceFileName?: unknown;
};

function extractSummaryFromAnalysis(analysis: Record<string, unknown>) {
  const scoreOverview = (analysis.scoreOverview || {}) as Record<string, unknown>;
  const creditLimitBreakdown = (analysis.creditLimitBreakdown || {}) as Record<string, unknown>;

  const trustScore = Number(scoreOverview.trustScore || 0);
  const trustLevel = typeof scoreOverview.trustLevel === "string" ? scoreOverview.trustLevel : "";
  const scorePercentile = Number(analysis.scorePercentile || 0);
  const approvedLimit = Number(creditLimitBreakdown.approvedLimit || analysis.recommendedCreditLimit || 0);
  const repaymentCapacity = Number(creditLimitBreakdown.repaymentCapacity || 0);

  return {
    trustScore,
    trustLevel,
    scorePercentile,
    approvedLimit,
    repaymentCapacity,
  };
}

export async function POST(req: NextRequest) {
  try {
    const uid = await requireUserId(req);
    const body = (await req.json()) as SaveAnalysisBody;

    if (!body.analysis || typeof body.analysis !== "object") {
      return jsonError("Analysis payload is required.", 400);
    }

    const analysis = body.analysis as Record<string, unknown>;
    const sourceFileName = parseOptionalString(body.sourceFileName);
    const summary = extractSummaryFromAnalysis(analysis);
    const nowMs = Date.now();
    const expiresAtMs = nowMs + ANALYSIS_RETENTION_MS;

    const analysisRef = analysisCollection(uid);
    const latestSnapshot = await analysisRef
      .orderBy("analyzedAtMs", "desc")
      .limit(1)
      .get();

    const latest = latestSnapshot.docs[0]?.data() as { expiresAtMs?: number } | undefined;
    if (latest?.expiresAtMs && latest.expiresAtMs > nowMs) {
      const nextUploadAt = new Date(latest.expiresAtMs).toISOString();
      return jsonError(`You can upload a new statement after ${nextUploadAt}.`, 409);
    }

    const recordRef = analysisRef.doc();
    await recordRef.set({
      sourceFileName,
      summary,
      analysis,
      analyzedAtMs: nowMs,
      expiresAtMs,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    return NextResponse.json({
      success: true,
      record: {
        id: recordRef.id,
        sourceFileName,
        summary,
        analyzedAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(error.message, 401);
    return jsonError(safeErrorMessage(error, "Failed to save analysis."), 500);
  }
}
