import { NextRequest, NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/server/auth";
import { jsonError, safeErrorMessage } from "@/lib/server/api";
import { loanInstallmentsCollection, loanRepaymentsCollection, loansCollection } from "@/lib/server/store";

export async function GET(req: NextRequest) {
  try {
    const uid = await requireUserId(req);
    const snapshot = await loansCollection(uid)
      .orderBy("createdAtMs", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return jsonError("No loan record found.", 404);
    }

    const loanDoc = snapshot.docs[0];
    const loanData = loanDoc.data() as Record<string, unknown>;

    const [installmentsSnapshot, repaymentsSnapshot] = await Promise.all([
      loanInstallmentsCollection(uid, loanDoc.id).orderBy("installmentNumber", "asc").get(),
      loanRepaymentsCollection(uid, loanDoc.id).orderBy("paidAtMs", "desc").limit(20).get(),
    ]);

    const installments = installmentsSnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        installmentNumber: Number(data.installmentNumber || 0),
        dueDate: Number(data.dueDateMs || 0) ? new Date(Number(data.dueDateMs)).toISOString() : null,
        emiAmount: Number(data.emiAmount || 0),
        principalComponent: Number(data.principalComponent || 0),
        interestComponent: Number(data.interestComponent || 0),
        paidAmount: Number(data.paidAmount || 0),
        status: typeof data.status === "string" ? data.status : "PENDING",
        paidAt: Number(data.paidAtMs || 0) ? new Date(Number(data.paidAtMs)).toISOString() : null,
      };
    });

    const repayments = repaymentsSnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        amount: Number(data.amount || 0),
        method: typeof data.method === "string" ? data.method : "UPI",
        reference: typeof data.reference === "string" ? data.reference : "",
        paidAt: Number(data.paidAtMs || 0) ? new Date(Number(data.paidAtMs)).toISOString() : null,
      };
    });

    return NextResponse.json({
      loan: {
        id: loanDoc.id,
        requestedAmount: Number(loanData.requestedAmount || 0),
        approvedAmount: Number(loanData.approvedAmount || 0),
        tenureMonths: Number(loanData.tenureMonths || 0),
        monthlyRate: Number(loanData.monthlyRate || 0),
        annualRate: Number(loanData.annualRate || 0),
        emi: Number(loanData.emi || 0),
        totalPayable: Number(loanData.totalPayable || 0),
        paidAmount: Number(loanData.paidAmount || 0),
        remainingAmount: Number(loanData.remainingAmount || 0),
        trustScore: Number(loanData.trustScore || 0),
        approvedLimit: Number(loanData.approvedLimit || 0),
        policyTier: typeof loanData.policyTier === "string" ? loanData.policyTier : "INELIGIBLE",
        policyReason: typeof loanData.policyReason === "string" ? loanData.policyReason : "",
        status: typeof loanData.status === "string" ? loanData.status : "PENDING",
        nextDueDate: Number(loanData.nextDueDateMs || 0) ? new Date(Number(loanData.nextDueDateMs)).toISOString() : null,
        createdAt: Number(loanData.createdAtMs || 0) ? new Date(Number(loanData.createdAtMs)).toISOString() : null,
      },
      installments,
      repayments,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(error.message, 401);
    return jsonError(safeErrorMessage(error, "Failed to load latest loan."), 500);
  }
}
