import mongoose from "mongoose";

const analysisRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sourceFileName: {
      type: String,
      default: "",
      trim: true,
    },
    summary: {
      trustScore: { type: Number, default: 0 },
      trustLevel: { type: String, default: "" },
      scorePercentile: { type: Number, default: 0 },
      approvedLimit: { type: Number, default: 0 },
      repaymentCapacity: { type: Number, default: 0 },
    },
    analysisPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

analysisRecordSchema.index({ user: 1, analyzedAt: -1 });

export default mongoose.model("AnalysisRecord", analysisRecordSchema);
