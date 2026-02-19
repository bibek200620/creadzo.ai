import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { requireUserId, UnauthorizedError } from "@/lib/server/auth";
import { jsonError, roundCurrency, safeErrorMessage } from "@/lib/server/api";
import {
  analysisCollection,
  loanInstallmentsCollection,
  loansCollection,
  loanRepaymentsCollection,
} from "@/lib/server/store";
import {
  buildInstallmentSchedule,
  calculateEmi,
  getLoanPolicy,
  getScoreBasedMaxLimit,
} from "@/lib/server/loanEngine";

type ApplyLoanBody = {
  amount?: unknown;
  tenureMonths?: unknown;
};

type LoanDoc = {
  requestedAmount: number;
  approvedAmount: number;
  tenureMonths: number;
  monthlyRate: number;
  annualRate: number;
  emi: number;
  totalPayable: number;
  paidAmount: number;
  remainingAmount: number;
  trustScore: number;
  approvedLimit: number;
  policyTier: string;
  policyReason: string;
  status: "ACTIVE" | "CLOSED" | "REJECTED" | "PENDING";
  nextDueDateMs: number | null;
  createdAtMs: number;
  updatedAtMs: number;
};

async function loadLatestActiveAnalysis(uid: string): Promise<{
  trustScore: number;
  approvedLimit: number;
}> {
  const snapshot = await analysisCollection(uid)
    .orderBy("analyzedAtMs", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error("Run credit analysis first before applying for a loan.");
  }

  const data = snapshot.docs[0].data() as {
    summary?: {
      trustScore?: number;
      approvedLimit?: number;
    };
    expiresAtMs?: number;
  };

  if (!data.expiresAtMs || Date.now() >= data.expiresAtMs) {
    throw new Error("Your analysis has expired. Upload a new statement.");
  }

  return {
    trustScore: Number(data.summary?.trustScore || 0),
    approvedLimit: Number(data.summary?.approvedLimit || 0),
  };
}

function mapLoanRecord(loanId: string, loan: Partial<LoanDoc>) {
  return {
    id: loanId,
    requestedAmount: Number(loan.requestedAmount || 0),
    approvedAmount: Number(loan.approvedAmount || 0),
    tenureMonths: Number(loan.tenureMonths || 0),
    monthlyRate: Number(loan.monthlyRate || 0),
    annualRate: Number(loan.annualRate || 0),
    emi: Number(loan.emi || 0),
    totalPayable: Number(loan.totalPayable || 0),
    paidAmount: Number(loan.paidAmount || 0),
    remainingAmount: Number(loan.remainingAmount || 0),
    trustScore: Number(loan.trustScore || 0),
    approvedLimit: Number(loan.approvedLimit || 0),
    policyTier: loan.policyTier || "INELIGIBLE",
    policyReason: loan.policyReason || "",
    status: loan.status || "PENDING",
    nextDueDate: loan.nextDueDateMs ? new Date(loan.nextDueDateMs).toISOString() : null,
    createdAt: loan.createdAtMs ? new Date(loan.createdAtMs).toISOString() : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const uid = await requireUserId(req);
    const snapshot = await loansCollection(uid)
      .orderBy("createdAtMs", "desc")
      .limit(20)
      .get();

    const loans = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const loan = doc.data() as Partial<LoanDoc>;

        const [installmentsSnapshot, repaymentsSnapshot] = await Promise.all([
          loanInstallmentsCollection(uid, doc.id).orderBy("installmentNumber", "asc").get(),
          loanRepaymentsCollection(uid, doc.id).orderBy("paidAtMs", "desc").limit(10).get(),
        ]);

        return {
          ...mapLoanRecord(doc.id, loan),
          installments: installmentsSnapshot.docs.map((instDoc) => {
            const data = instDoc.data() as Record<string, unknown>;
            return {
              id: instDoc.id,
              installmentNumber: Number(data.installmentNumber || 0),
              dueDate: Number(data.dueDateMs || 0) ? new Date(Number(data.dueDateMs)).toISOString() : null,
              emiAmount: Number(data.emiAmount || 0),
              principalComponent: Number(data.principalComponent || 0),
              interestComponent: Number(data.interestComponent || 0),
              paidAmount: Number(data.paidAmount || 0),
              status: typeof data.status === "string" ? data.status : "PENDING",
              paidAt: Number(data.paidAtMs || 0) ? new Date(Number(data.paidAtMs)).toISOString() : null,
            };
          }),
          repayments: repaymentsSnapshot.docs.map((repDoc) => {
            const data = repDoc.data() as Record<string, unknown>;
            return {
              id: repDoc.id,
              amount: Number(data.amount || 0),
              method: typeof data.method === "string" ? data.method : "UPI",
              reference: typeof data.reference === "string" ? data.reference : "",
              paidAt: Number(data.paidAtMs || 0) ? new Date(Number(data.paidAtMs)).toISOString() : null,
            };
          }),
        };
      }),
    );

    return NextResponse.json({ loans });
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(error.message, 401);
    return jsonError(safeErrorMessage(error, "Failed to load loans."), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await requireUserId(req);
    const body = (await req.json()) as ApplyLoanBody;
    const amount = Number(body.amount || 0);
    const tenureMonths = Number(body.tenureMonths || 0);

    if (!Number.isFinite(amount) || amount < 1000) {
      return jsonError("Loan amount must be at least ₹1,000.", 400);
    }
    if (!Number.isFinite(tenureMonths) || tenureMonths < 1) {
      return jsonError("Tenure must be at least 1 month.", 400);
    }

    const { trustScore, approvedLimit } = await loadLatestActiveAnalysis(uid);
    const policy = getLoanPolicy(trustScore);

    if (!policy.eligible) {
      return jsonError(policy.reason, 400);
    }

    const maxLimit = getScoreBasedMaxLimit(approvedLimit, policy.limitFactor);
    if (amount > maxLimit) {
      return jsonError(`Requested amount exceeds score-based max limit of ₹${maxLimit.toLocaleString()}.`, 400);
    }
    if (tenureMonths > policy.maxTenure) {
      return jsonError(`Maximum allowed tenure for your tier is ${policy.maxTenure} months.`, 400);
    }

    const nowMs = Date.now();
    const emi = calculateEmi(amount, policy.monthlyRate, tenureMonths);
    const totalPayable = roundCurrency(emi * tenureMonths);
    const installments = buildInstallmentSchedule(amount, policy.monthlyRate, tenureMonths, nowMs);
    const nextDueDateMs = installments[0]?.dueDateMs || null;
    const annualRate = roundCurrency(policy.monthlyRate * 12);

    const loanPayload: LoanDoc = {
      requestedAmount: amount,
      approvedAmount: amount,
      tenureMonths,
      monthlyRate: policy.monthlyRate,
      annualRate,
      emi,
      totalPayable,
      paidAmount: 0,
      remainingAmount: totalPayable,
      trustScore,
      approvedLimit,
      policyTier: policy.tier,
      policyReason: policy.reason,
      status: "ACTIVE",
      nextDueDateMs,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    const db = getAdminDb();
    const loanRef = loansCollection(uid).doc();
    const batch = db.batch();
    batch.set(loanRef, loanPayload);

    installments.forEach((installment) => {
      const installmentRef = loanInstallmentsCollection(uid, loanRef.id).doc();
      batch.set(installmentRef, {
        ...installment,
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
      });
    });

    await batch.commit();

    return NextResponse.json({
      loan: mapLoanRecord(loanRef.id, loanPayload),
      policy: {
        ...policy,
        maxLimit,
      },
      installments: installments.map((item) => ({
        ...item,
        dueDate: new Date(item.dueDateMs).toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(error.message, 401);
    return jsonError(safeErrorMessage(error, "Loan application failed."), 500);
  }
}
