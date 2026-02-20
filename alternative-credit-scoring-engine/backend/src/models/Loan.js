import mongoose from "mongoose";

const scheduleItemSchema = new mongoose.Schema(
  {
    installmentNumber: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    emiAmount: { type: Number, required: true },
    principalComponent: { type: Number, required: true },
    interestComponent: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paidAt: { type: Date, default: null },
    status: { type: String, enum: ["PENDING", "PAID"], default: "PENDING" },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    paidAt: { type: Date, required: true },
    amount: { type: Number, required: true },
    method: { type: String, default: "UPI" },
    reference: { type: String, required: true },
  },
  { _id: false }
);

const loanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    statement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Statement",
      required: true,
    },
    requestedAmount: { type: Number, required: true },
    approvedAmount: { type: Number, default: 0 },
    purpose: { type: String, default: "General" },
    tenureMonths: { type: Number, required: true },
    annualInterestRate: { type: Number, default: 0 },
    monthlyInterestRate: { type: Number, default: 0 },
    emi: { type: Number, default: 0 },
    totalRepayable: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    decisionReasons: { type: [String], default: [] },
    offerSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    recommendationsSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ["PENDING", "REJECTED", "APPROVED", "ACTIVE", "CLOSED"],
      default: "PENDING",
      index: true,
    },
    appliedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
    disbursedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "" },
    nextDueDate: { type: Date, default: null },
    schedule: { type: [scheduleItemSchema], default: [] },
    payments: { type: [paymentSchema], default: [] },
  },
  { timestamps: true }
);

loanSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Loan", loanSchema);
