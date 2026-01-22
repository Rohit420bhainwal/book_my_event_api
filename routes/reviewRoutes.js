import express from "express";
import {
  createReview,
  getProviderReviews,
  getProviderRatingSummary,
  getReviewById,
} from "../controllers/reviewController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * CUSTOMER
 * Create review for a completed booking
 */
router.post("/", protect, createReview);

/**
 * PUBLIC
 * Get all reviews for a provider
 */
router.get("/provider/:providerId", getProviderReviews);

/**
 * PUBLIC
 * Get provider rating summary
 */
router.get("/provider/:providerId/summary", getProviderRatingSummary);

router.get("/:reviewId", getReviewById);

export default router;
