import mongoose from "mongoose";
import Statement from "../models/Statement.js";
import Loan from "../models/Loan.js";
import {
  buildLoanOffers,
  buildRepaymentSchedule,
  calculateEmi,
  evaluateLoanRequest,
  getNextPendingDueDate,
} from "../services/loanService.js";

async function getLatestStatement(userId) {
  return Statement.findOne({ user: userId }).sort({ createdAt: -1 });
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getInstallmentOutstanding(installment) {
  const emiAmount = Number(installment?.emiAmount || 0);
  const paidAmount = Number(installment?.paidAmount || 0);
  return round2(Math.max(0, emiAmount - paidAmount));
}

function buildRepaymentSummary(loan) {
  const schedule = Array.isArray(loan?.schedule) ? loan.schedule : [];
  const totalInstallments = schedule.length;

  if (totalInstallments === 0) {
    return {
      totalInstallments: 0,
      paidInstallments: 0,
      pendingInstallments: 0,
      paidAmount: round2(loan?.paidAmount || 0),
      outstandingAmount: round2(loan?.remainingAmount || 0),
      dueNowAmount: 0,
      nextInstallmentAmount: 0,
      nextInstallmentDueDate: null,
    };
  }

  const now = Date.now();
  const pending = schedule.filter((item) => item.status !== "PAID");
  const paidInstallments = totalInstallments - pending.length;
  const nextPending = pending[0] || null;

  let dueNowAmount = 0;
  for (const installment of pending) {
    const dueDate = installment?.dueDate ? new Date(installment.dueDate).getTime() : null;
    if (dueDate && dueDate <= now) {
      dueNowAmount += getInstallmentOutstanding(installment);
    }
  }

  return {
    totalInstallments,
    paidInstallments,
    pendingInstallments: pending.length,
    paidAmount: round2(loan?.paidAmount || 0),
    outstandingAmount: round2(loan?.remainingAmount || 0),
    dueNowAmount: round2(dueNowAmount),
    nextInstallmentAmount: nextPending ? getInstallmentOutstanding(nextPending) : 0,
    nextInstallmentDueDate: nextPending?.dueDate || null,
    nextInstallmentNumber: nextPending?.installmentNumber || null,
  };
}

function mapApplicant(userValue) {
  if (!userValue || typeof userValue !== "object") return null;
  const looksPopulated = "name" in userValue || "email" in userValue || "phone" in userValue;
  if (!looksPopulated) return null;

  const id = userValue._id || userValue.id;
  if (!id) return null;

  return {
    id: String(id),
    name: userValue.name || "",
    email: userValue.email || "",
    phone: userValue.phone || "",
    role: userValue.role || "USER",
  };
}

function buildLoanResponse(loan) {
  const applicant = mapApplicant(loan.user);

  const payload = {
    id: String(loan._id || loan.id || ""),
    requestedAmount: loan.requestedAmount,
    approvedAmount: loan.approvedAmount,
    purpose: loan.purpose,
    tenureMonths: loan.tenureMonths,
    annualInterestRate: loan.annualInterestRate,
    monthlyInterestRate: loan.monthlyInterestRate,
    emi: loan.emi,
    totalRepayable: loan.totalRepayable,
    paidAmount: loan.paidAmount,
    remainingAmount: loan.remainingAmount,
    status: loan.status,
    appliedAt: loan.appliedAt,
    approvedAt: loan.approvedAt,
    disbursedAt: loan.disbursedAt,
    reviewedBy: loan.reviewedBy,
    reviewedAt: loan.reviewedAt,
    reviewNote: loan.reviewNote,
    nextDueDate: loan.nextDueDate,
    decisionReasons: loan.decisionReasons,
    offerSummary: loan.offerSummary,
    schedule: loan.schedule,
    payments: loan.payments,
    repaymentSummary: buildRepaymentSummary(loan),
  };

  if (applicant) {
    payload.applicant = applicant;
  }

  return payload;
}

async function applyPaymentToLoan({ loan, amount, method }) {
  let remainingPayment = Number(amount || 0);
  let appliedAmount = 0;

  for (const installment of loan.schedule) {
    if (remainingPayment <= 0) break;
    if (installment.status === "PAID") continue;

    const dueRemaining = getInstallmentOutstanding(installment);
    if (dueRemaining <= 0) {
      installment.status = "PAID";
      continue;
    }

    const payNow = Math.min(remainingPayment, dueRemaining);
    installment.paidAmount = round2((installment.paidAmount || 0) + payNow);
    appliedAmount = round2(appliedAmount + payNow);
    remainingPayment = round2(remainingPayment - payNow);

    if (installment.paidAmount >= installment.emiAmount - 0.01) {
      installment.status = "PAID";
      installment.paidAt = new Date();
    }
  }

  if (appliedAmount <= 0) {
    return {
      appliedAmount: 0,
      unappliedAmount: Number(amount || 0),
    };
  }

  loan.paidAmount = round2((loan.paidAmount || 0) + appliedAmount);
  loan.remainingAmount = round2(Math.max(0, (loan.totalRepayable || 0) - loan.paidAmount));

  loan.payments.push({
    paidAt: new Date(),
    amount: appliedAmount,
    method: String(method || "UPI").trim() || "UPI",
    reference: `PMT-${Date.now()}`,
  });

  if (loan.remainingAmount <= 0.01) {
    loan.status = "CLOSED";
    loan.nextDueDate = null;
  } else {
    loan.nextDueDate = getNextPendingDueDate(loan.schedule);
  }

  loan.markModified("schedule");
  await loan.save();

  return {
    appliedAmount,
    unappliedAmount: Math.max(0, remainingPayment),
  };
}

export async function getLoanOffers(req, res) {
  try {
    const latestStatement = await getLatestStatement(req.user._id);

    if (!latestStatement) {
      return res.status(404).json({
        message: "No statement analysis found. Upload a bank statement before requesting loan offers.",
      });
    }

    const offers = buildLoanOffers(latestStatement);

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      statementId: latestStatement._id,
      offers,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch loan offers", error: error.message });
  }
}

export async function applyForLoan(req, res) {
  try {
    const amount = Number(req.body.amount);
    const tenureMonths = Number(req.body.tenureMonths);
    const purpose = String(req.body.purpose || "General").trim().slice(0, 80);

    const latestStatement = await getLatestStatement(req.user._id);

    if (!latestStatement) {
      return res.status(404).json({
        message: "No statement analysis found. Upload a bank statement before applying.",
      });
    }

    const existingOpenLoan = await Loan.findOne({
      user: req.user._id,
      status: { $in: ["PENDING", "APPROVED", "ACTIVE"] },
    }).sort({ createdAt: -1 });

    if (existingOpenLoan) {
      return res.status(409).json({
        message: "You already have an in-progress loan. Complete review/disbursement/repayment before applying again.",
        existingLoan: buildLoanResponse(existingOpenLoan),
      });
    }

    const evaluation = evaluateLoanRequest(latestStatement, amount, tenureMonths);

    if (evaluation.decision === "REJECTED") {
      const rejectedLoan = await Loan.create({
        user: req.user._id,
        statement: latestStatement._id,
        requestedAmount: amount || 0,
        approvedAmount: 0,
        purpose,
        tenureMonths: tenureMonths || 0,
        annualInterestRate: evaluation.offerSummary?.annualInterestRate || 0,
        monthlyInterestRate: 0,
        emi: 0,
        totalRepayable: 0,
        paidAmount: 0,
        remainingAmount: 0,
        decisionReasons: evaluation.reasons,
        offerSummary: evaluation.offerSummary,
        recommendationsSnapshot: latestStatement.recommendations || null,
        status: "REJECTED",
        appliedAt: new Date(),
        reviewedAt: new Date(),
        reviewNote: "Auto-rejected by eligibility rules.",
      });

      return res.status(200).json({
        decision: "REJECTED",
        message: "Loan request was not approved.",
        reasons: evaluation.reasons,
        loan: buildLoanResponse(rejectedLoan),
      });
    }

    const terms = evaluation.loanTerms;

    const pendingLoan = await Loan.create({
      user: req.user._id,
      statement: latestStatement._id,
      requestedAmount: amount,
      approvedAmount: terms.amount,
      purpose,
      tenureMonths: terms.tenureMonths,
      annualInterestRate: terms.annualInterestRate,
      monthlyInterestRate: terms.monthlyInterestRate,
      emi: terms.emi,
      totalRepayable: terms.totalRepayable,
      paidAmount: 0,
      remainingAmount: terms.totalRepayable,
      decisionReasons: ["Application submitted and pending approver review."],
      offerSummary: evaluation.offerSummary,
      recommendationsSnapshot: latestStatement.recommendations || null,
      status: "PENDING",
      appliedAt: new Date(),
      nextDueDate: null,
      schedule: [],
      payments: [],
    });

    return res.status(201).json({
      decision: "PENDING",
      message: "Loan application submitted. Waiting for approver decision.",
      reasons: ["Underwriting pre-check passed and queued for review."],
      loan: buildLoanResponse(pendingLoan),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to apply for loan", error: error.message });
  }
}

export async function getAdminLoanQueue(req, res) {
  try {
    const allowedStatuses = ["PENDING", "APPROVED", "ACTIVE", "CLOSED", "REJECTED", "ALL"];
    const status = req.query.status ? String(req.query.status).toUpperCase() : "PENDING";

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status filter for loan queue" });
    }

    const filter = status === "ALL" ? {} : { status };

    const loans = await Loan.find(filter)
      .populate("user", "name email phone role")
      .sort({ appliedAt: 1 })
      .lean();

    return res.status(200).json({
      count: loans.length,
      loans: loans.map((loan) => buildLoanResponse(loan)),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch approver queue", error: error.message });
  }
}

export async function reviewLoanApplication(req, res) {
  try {
    const { loanId } = req.params;
    const action = String(req.body.action || "").trim().toUpperCase();
    const reviewNote = String(req.body.note || "").trim().slice(0, 250);

    if (!mongoose.isValidObjectId(loanId)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }

    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ message: "Action must be APPROVE or REJECT" });
    }

    const loan = await Loan.findById(loanId);

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    if (loan.status !== "PENDING") {
      return res.status(400).json({ message: "Only pending loans can be reviewed" });
    }

    const reviewedAt = new Date();
    loan.reviewedBy = req.user._id;
    loan.reviewedAt = reviewedAt;
    loan.reviewNote = reviewNote;

    if (action === "REJECT") {
      loan.status = "REJECTED";
      loan.approvedAmount = 0;
      loan.monthlyInterestRate = 0;
      loan.emi = 0;
      loan.totalRepayable = 0;
      loan.paidAmount = 0;
      loan.remainingAmount = 0;
      loan.nextDueDate = null;
      loan.approvedAt = null;
      loan.schedule = [];
      loan.payments = [];
      loan.decisionReasons = [reviewNote || "Application rejected by loan approver."];

      await loan.save();

      return res.status(200).json({
        message: "Loan rejected successfully",
        loan: buildLoanResponse(loan),
      });
    }

    const approvedAmount = Number(req.body.approvedAmount || loan.approvedAmount || loan.requestedAmount);
    const tenureMonths = Number(req.body.tenureMonths || loan.tenureMonths);
    const annualInterestRate = Number(
      req.body.annualInterestRate || loan.annualInterestRate || loan.offerSummary?.annualInterestRate || 24
    );

    if (!Number.isFinite(approvedAmount) || approvedAmount < 5000) {
      return res.status(400).json({ message: "Approved amount must be at least ₹5,000" });
    }

    if (!Number.isFinite(tenureMonths) || tenureMonths < 3 || tenureMonths > 36) {
      return res.status(400).json({ message: "Approved tenure must be between 3 and 36 months" });
    }

    if (!Number.isFinite(annualInterestRate) || annualInterestRate <= 0 || annualInterestRate > 60) {
      return res.status(400).json({ message: "Annual interest rate must be between 0 and 60" });
    }

    const emiTerms = calculateEmi(approvedAmount, annualInterestRate, tenureMonths);
    const schedule = buildRepaymentSchedule({
      principal: approvedAmount,
      annualInterestRate,
      tenureMonths,
      startDate: reviewedAt,
    });

    loan.status = "APPROVED";
    loan.approvedAmount = approvedAmount;
    loan.tenureMonths = tenureMonths;
    loan.annualInterestRate = annualInterestRate;
    loan.monthlyInterestRate = emiTerms.monthlyInterestRate;
    loan.emi = emiTerms.emi;
    loan.totalRepayable = emiTerms.totalRepayable;
    loan.paidAmount = 0;
    loan.remainingAmount = emiTerms.totalRepayable;
    loan.schedule = schedule;
    loan.payments = [];
    loan.approvedAt = reviewedAt;
    loan.nextDueDate = getNextPendingDueDate(schedule);
    loan.decisionReasons = [reviewNote || "Application approved by loan approver."];

    await loan.save();

    return res.status(200).json({
      message: "Loan approved successfully",
      loan: buildLoanResponse(loan),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to review loan", error: error.message });
  }
}

export async function disburseLoan(req, res) {
  try {
    const { loanId } = req.params;

    if (!mongoose.isValidObjectId(loanId)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }

    const loan = await Loan.findOne({ _id: loanId, user: req.user._id });

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    if (loan.status !== "APPROVED") {
      return res.status(400).json({ message: "Only approved loans can be disbursed" });
    }

    loan.status = "ACTIVE";
    loan.disbursedAt = new Date();
    loan.nextDueDate = getNextPendingDueDate(loan.schedule);

    await loan.save();

    return res.status(200).json({
      message: "Loan disbursed successfully and marked active.",
      loan: buildLoanResponse(loan),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to disburse loan", error: error.message });
  }
}

export async function getLoanRepaymentSummary(req, res) {
  try {
    const { loanId } = req.params;

    if (!mongoose.isValidObjectId(loanId)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }

    const loan = await Loan.findOne({ _id: loanId, user: req.user._id }).lean();

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    return res.status(200).json({
      loan: buildLoanResponse(loan),
      repaymentSummary: buildRepaymentSummary(loan),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch repayment summary", error: error.message });
  }
}

export async function makeLoanPayment(req, res) {
  try {
    const { loanId } = req.params;
    const amount = Number(req.body.amount);
    const method = String(req.body.method || "UPI").trim();

    if (!mongoose.isValidObjectId(loanId)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than zero" });
    }

    const loan = await Loan.findOne({ _id: loanId, user: req.user._id });

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    if (loan.status !== "ACTIVE") {
      return res.status(400).json({ message: "Payments are allowed only on active loans" });
    }

    const { appliedAmount, unappliedAmount } = await applyPaymentToLoan({ loan, amount, method });

    if (appliedAmount <= 0) {
      return res.status(400).json({ message: "No payable installment found for this loan." });
    }

    return res.status(200).json({
      message: "Payment recorded successfully",
      appliedAmount,
      unappliedAmount,
      loan: buildLoanResponse(loan),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to record payment", error: error.message });
  }
}

export async function payNextLoanEmi(req, res) {
  try {
    const { loanId } = req.params;
    const method = String(req.body.method || "UPI").trim();

    if (!mongoose.isValidObjectId(loanId)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }

    const loan = await Loan.findOne({ _id: loanId, user: req.user._id });

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    if (loan.status !== "ACTIVE") {
      return res.status(400).json({ message: "Payments are allowed only on active loans" });
    }

    const nextInstallment = loan.schedule.find((item) => item.status !== "PAID");

    if (!nextInstallment) {
      return res.status(400).json({ message: "No pending EMI available for this loan" });
    }

    const amount = getInstallmentOutstanding(nextInstallment);

    if (amount <= 0) {
      return res.status(400).json({ message: "Next EMI already paid" });
    }

    const { appliedAmount } = await applyPaymentToLoan({ loan, amount, method });

    return res.status(200).json({
      message: "Next EMI payment recorded successfully",
      appliedAmount,
      loan: buildLoanResponse(loan),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to pay next EMI", error: error.message });
  }
}

export async function payLoanInFull(req, res) {
  try {
    const { loanId } = req.params;
    const method = String(req.body.method || "UPI").trim();

    if (!mongoose.isValidObjectId(loanId)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }

    const loan = await Loan.findOne({ _id: loanId, user: req.user._id });

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    if (loan.status !== "ACTIVE") {
      return res.status(400).json({ message: "Payments are allowed only on active loans" });
    }

    const amount = Number(loan.remainingAmount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "No outstanding amount remaining" });
    }

    const { appliedAmount } = await applyPaymentToLoan({ loan, amount, method });

    return res.status(200).json({
      message: "Full repayment completed successfully",
      appliedAmount,
      loan: buildLoanResponse(loan),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to close loan repayment", error: error.message });
  }
}

export async function getMyLoans(req, res) {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const filter = { user: req.user._id };

    if (status) {
      filter.status = status;
    }

    const loans = await Loan.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      count: loans.length,
      loans: loans.map((loan) => buildLoanResponse(loan)),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch loans", error: error.message });
  }
}

export async function getLoanDetails(req, res) {
  try {
    const { loanId } = req.params;

    if (!mongoose.isValidObjectId(loanId)) {
      return res.status(400).json({ message: "Invalid loan id" });
    }

    const loan = await Loan.findOne({ _id: loanId, user: req.user._id }).lean();

    if (!loan) {
      return res.status(404).json({ message: "Loan not found" });
    }

    return res.status(200).json({
      loan: buildLoanResponse(loan),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch loan details", error: error.message });
  }
}
