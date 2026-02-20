import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    category: { type: String, default: "Other" },
    balance: { type: Number, default: null },
    flags: {
      isSalary: { type: Boolean, default: false },
      isUtility: { type: Boolean, default: false },
      isEmi: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const statementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ["pdf", "csv"], required: true },
    transactions: { type: [transactionSchema], default: [] },
    analytics: { type: mongoose.Schema.Types.Mixed, required: true },
    score: { type: mongoose.Schema.Types.Mixed, required: true },
    recommendations: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

statementSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Statement", statementSchema);
