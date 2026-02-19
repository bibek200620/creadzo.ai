import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { requireUserId, UnauthorizedError } from "@/lib/server/auth";
import { jsonError, parseOptionalString, roundCurrency, safeErrorMessage } from "@/lib/server/api";
import { loanInstallmentsCollection, loanRepaymentsCollection, loansCollection } from "@/lib/server/store";

type RepayBody = {
  loanId?: unknown;
  amount?: unknown;
  method?: unknown;
};

type LoanRecord = {
  totalPayable: number;
  paidAmount: number;
  remainingAmount: number;
  status: "ACTIVE" | "CLOSED" | "PENDING" | "REJECTED";
  nextDueDateMs: number | null;
};

type InstallmentRecord = {
  installmentNumber: number;
  dueDateMs: number;
  emiAmount: number;
  paidAmount: number;
  status: "PENDING" | "PAID";
  paidAtMs: number | null;
};

export async function POST(req: NextRequest) {
  try {
    const uid = await requireUserId(req);
    const body = (await req.json()) as RepayBody;
    const loanId = parseOptionalString(body.loanId);
    const amount = Number(body.amount || 0);
    const method = parseOptionalString(body.method) || "UPI";

    if (!loanId) return jsonError("Loan ID is required.", 400);
    if (!Number.isFinite(amount) || amount <= 0) return jsonError("Repayment amount must be greater than 0.", 400);

    const db = getAdminDb();
    const loanRef = loansCollection(uid).doc(loanId);
    const installmentsRef = loanInstallmentsCollection(uid, loanId);
    const repaymentsRef = loanRepaymentsCollection(uid, loanId);

    const result = await db.runTransaction(async (tx) => {
      const loanSnap = await tx.get(loanRef);
      if (!loanSnap.exists) {
        throw new Error("Loan not found.");
      }

      const loan = loanSnap.data() as Partial<LoanRecord>;
      const totalPayable = Number(loan.totalPayable || 0);
      const paidAmount = Number(loan.paidAmount || 0);
      const remainingAmount = Number(loan.remainingAmount || Math.max(0, totalPayable - paidAmount));
      const status = loan.status || "PENDING";

      if (status !== "ACTIVE") {
        throw new Error("Only active loans can be repaid.");
      }
      if (amount > remainingAmount) {
        throw new Error(`Repayment amount exceeds pending balance of ₹${remainingAmount.toLocaleString()}.`);
      }

      const installmentQuery = installmentsRef.orderBy("installmentNumber", "asc");
      const installmentSnapshot = await tx.get(installmentQuery);

      const nowMs = Date.now();
      let allocatable = roundCurrency(amount);

      const modeledInstallments = installmentSnapshot.docs.map((doc) => {
        const data = doc.data() as Partial<InstallmentRecord>;
        return {
          ref: doc.ref,
          installmentNumber: Number(data.installmentNumber || 0),
          dueDateMs: Number(data.dueDateMs || 0),
          emiAmount: Number(data.emiAmount || 0),
          paidAmount: Number(data.paidAmount || 0),
          status: (data.status || "PENDING") as "PENDING" | "PAID",
          paidAtMs: data.paidAtMs ?? null,
        };
      });

      for (const installment of modeledInstallments) {
        if (allocatable <= 0) break;
        if (installment.status === "PAID") continue;

        const due = roundCurrency(Math.max(0, installment.emiAmount - installment.paidAmount));
        if (due <= 0) {
          installment.status = "PAID";
          continue;
        }

        const applied = roundCurrency(Math.min(allocatable, due));
        if (applied <= 0) continue;

        installment.paidAmount = roundCurrency(installment.paidAmount + applied);
        allocatable = roundCurrency(allocatable - applied);

        if (installment.paidAmount + 0.01 >= installment.emiAmount) {
          installment.status = "PAID";
          installment.paidAtMs = nowMs;
        }

        tx.update(installment.ref, {
          paidAmount: installment.paidAmount,
          status: installment.status,
          paidAtMs: installment.paidAtMs,
          updatedAtMs: nowMs,
        });
      }

      const newPaidAmount = roundCurrency(paidAmount + amount);
      const newRemainingAmount = roundCurrency(Math.max(0, totalPayable - newPaidAmount));
      const nextPending = modeledInstallments.find((item) => item.status !== "PAID");
      const nextStatus = newRemainingAmount <= 0.01 || !nextPending ? "CLOSED" : "ACTIVE";
      const nextDueDateMs = nextStatus === "CLOSED" ? null : nextPending?.dueDateMs || null;

      tx.update(loanRef, {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: nextStatus,
        nextDueDateMs,
        updatedAtMs: nowMs,
      });

      const repaymentRef = repaymentsRef.doc();
      const reference = `RPY-${nowMs}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      tx.set(repaymentRef, {
        amount: roundCurrency(amount),
        method,
        reference,
        paidAtMs: nowMs,
        createdAtMs: nowMs,
      });

      return {
        loanId,
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: nextStatus,
        nextDueDate: nextDueDateMs ? new Date(nextDueDateMs).toISOString() : null,
        repayment: {
          id: repaymentRef.id,
          amount: roundCurrency(amount),
          method,
          reference,
          paidAt: new Date(nowMs).toISOString(),
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(error.message, 401);
    return jsonError(safeErrorMessage(error, "Repayment failed."), 500);
  }
}
