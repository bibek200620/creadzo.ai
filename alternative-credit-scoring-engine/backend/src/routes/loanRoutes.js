import { Router } from "express";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";
import {
  applyForLoan,
  disburseLoan,
  getAdminLoanQueue,
  getLoanDetails,
  getLoanOffers,
  getLoanRepaymentSummary,
  getMyLoans,
  makeLoanPayment,
  payLoanInFull,
  payNextLoanEmi,
  reviewLoanApplication,
} from "../controllers/loanController.js";

const router = Router();

router.get("/offers", protect, getLoanOffers);
router.post("/apply", protect, applyForLoan);
router.get("/my-loans", protect, getMyLoans);
router.get("/admin/pending", protect, requireAdmin, getAdminLoanQueue);
router.post("/admin/:loanId/decision", protect, requireAdmin, reviewLoanApplication);
router.get("/:loanId/repayment-summary", protect, getLoanRepaymentSummary);
router.post("/:loanId/pay-emi", protect, payNextLoanEmi);
router.post("/:loanId/pay-full", protect, payLoanInFull);
router.get("/:loanId", protect, getLoanDetails);
router.post("/:loanId/disburse", protect, disburseLoan);
router.post("/:loanId/pay", protect, makeLoanPayment);

export default router;
