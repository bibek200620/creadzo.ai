import Statement from "../models/Statement.js";

export async function getAnalyticsSummary(req, res) {
  try {
    const latestStatement = await Statement.findOne({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestStatement) {
      return res.status(404).json({ message: "No statement analysis found. Upload a statement first." });
    }

    return res.status(200).json({
      user: {
        id: String(req.user._id),
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role || "USER",
        dob: req.user.dob || null,
        currentAddress: req.user.currentAddress || "",
        permanentAddress: req.user.permanentAddress || "",
        pan: req.user.pan || "",
        aadhaar: req.user.aadhaar || "",
        employmentType: req.user.employmentType || "",
        monthlyIncome: Number(req.user.monthlyIncome || 0),
      },
      statement: {
        id: latestStatement._id,
        fileName: latestStatement.fileName,
        fileType: latestStatement.fileType,
        uploadedAt: latestStatement.createdAt,
      },
      analytics: latestStatement.analytics,
      score: latestStatement.score,
      recommendations: latestStatement.recommendations || null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch analytics summary", error: error.message });
  }
}
