import express from "express";
import { getAllProviders,getProviderById,updateProviderStatus,
    getAllWithdrawRequests,
  approveWithdrawRequest,
  rejectWithdrawRequest,
  runAutoPayout,
} from "../controllers/adminController.js";
import { protect, verifyAdmin } from "../middleware/authMiddleware.js";
import { adminRefundBooking,autoRefundBooking } from "../controllers/adminRefundController.js";
const router = express.Router();

router.get("/providers", protect, verifyAdmin, getAllProviders);
router.get("/provider/:id", protect, verifyAdmin, getProviderById);
// Update provider status
router.put("/provider/:id/status", protect, verifyAdmin, updateProviderStatus);

router.get("/withdraws", protect, verifyAdmin, getAllWithdrawRequests);
router.put("/withdraw/:withdrawId/approve", protect, verifyAdmin, approveWithdrawRequest);
router.put("/withdraw/:withdrawId/reject", protect, verifyAdmin, rejectWithdrawRequest);
router.post("/run-auto-payout", protect, verifyAdmin, runAutoPayout);
router.post("/refund/:bookingId", protect, verifyAdmin, adminRefundBooking);
router.post("/auto-refund",protect,verifyAdmin,autoRefundBooking)

export default router;
