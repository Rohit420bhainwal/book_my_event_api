import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createStripeAccount,
  getStripeOnboardingLink,
} from "../controllers/providerStripeController.js";

const router = express.Router();

router.post("/create-account", protect, createStripeAccount);
router.post("/onboarding-link", protect, getStripeOnboardingLink);

export default router;
