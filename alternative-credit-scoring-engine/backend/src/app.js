import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import bankRoutes from "./routes/bankRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import scoreRoutes from "./routes/scoreRoutes.js";
import loanRoutes from "./routes/loanRoutes.js";
import analysisRecordRoutes from "./routes/analysisRecordRoutes.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "Alternative Credit Scoring Engine API" });
});

// Primary API routes (with /api prefix for frontend clients)
app.use("/api/auth", authRoutes);
app.use("/api/bank", bankRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/analytics", historyRoutes);
app.use("/api/score", scoreRoutes);
app.use("/api/loan", loanRoutes);
app.use("/api/analysis", analysisRecordRoutes);

// Aliased routes to match required endpoint format exactly
app.use("/auth", authRoutes);
app.use("/bank", bankRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/analytics", historyRoutes);
app.use("/score", scoreRoutes);
app.use("/loan", loanRoutes);
app.use("/analysis", analysisRecordRoutes);

app.use((err, req, res, next) => {
  if (err && err.message) {
    const status = err.message.includes("Only .pdf and .csv") ? 400 : 500;
    return res.status(status).json({ message: err.message });
  }

  return res.status(500).json({ message: "Unexpected server error" });
});

export default app;
