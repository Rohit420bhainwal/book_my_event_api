import express from "express";
import { createBooking, getMyBookings, 
    getProviderBookings, updateBookingStatus,
    getBookingById,getAllBookingsForAdmin} from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js"; // JWT auth middleware

const router = express.Router();

router.post("/", protect, createBooking);                  // Customer creates booking
router.get("/me", protect, getMyBookings);                // Customer views own bookings
router.get("/provider", protect, getProviderBookings);    // Provider views bookings for their services
router.put("/:bookingId/status", protect, updateBookingStatus);
router.get("/:bookingId", getBookingById);
router.get("/admin/all", protect, getAllBookingsForAdmin);

export default router;
