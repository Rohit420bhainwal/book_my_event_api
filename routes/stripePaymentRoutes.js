import express from "express";
import { createPaymentIntent } from "../controllers/stripePaymentController.js";
import { protect } from "../middleware/authMiddleware.js";
// import { protect } from "../middleware/authMiddleware.js"; // optional

const router = express.Router();

// POST /api/payment/create-payment-intent
router.post("/create-payment-intent",protect, createPaymentIntent);

export default router;
