import express from "express";
import {
  login,
  sendOtp,
  verifyOtp,
  setRole,
  providerSubmitInfo,
  upload,
  checkProviderStatus,
  providerService,
  getProviderServices,
  getServicesByCity,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/set-role", setRole);

// Provider onboarding (no services)
router.post(
  "/provider-submit-info",
  protect,
  upload.array("images", 5),
  providerSubmitInfo
);

// Add/Edit/Delete services (after approval)
router.post(
  "/provider-service",
  protect,
  upload.array("images", 5),
  providerService
);

// Check provider approval status
router.get("/check-provider-status/:userId", checkProviderStatus);

router.get("/provider-services/:userId", protect, getProviderServices);

router.get("/services-by-city", protect, getServicesByCity);

export default router;
