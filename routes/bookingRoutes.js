import express, { request } from "express";
import { createBooking, getMyBookings, 
    getProviderBookings, updateBookingStatus,
    getBookingById,getAllBookingsForAdmin,createPaymentIntent,
    confirmBooking,requestWithdraw,cancelBookingByProvider,

} from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js"; // JWT auth middleware

import { withdrawBookingAmount } from "../controllers/bookingWithdrawController.js";

import { getProviderEarningsSummary } from "../controllers/providerDashboardController.js";

const router = express.Router();
router.post("/payment-intent", protect, createPaymentIntent); 
router.post("/confirm", protect, confirmBooking);

router.post("/", protect, createBooking);                  // Customer creates booking
router.get("/me", protect, getMyBookings);                // Customer views own bookings
router.get("/provider", protect, getProviderBookings);    // Provider views bookings for their services
router.put("/:bookingId/status", protect, updateBookingStatus);
router.get("/:bookingId", getBookingById);
router.get("/admin/all", protect, getAllBookingsForAdmin);
router.post("/:bookingId/withdraw", protect, withdrawBookingAmount);

router.get("/provider/earnings", protect, getProviderEarningsSummary);
router.post("/requestWithdraw",protect,requestWithdraw);
router.post("/provider/:bookingId/cancel",protect,cancelBookingByProvider);
  

export default router;
