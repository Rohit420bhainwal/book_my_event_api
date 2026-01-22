import express from "express";
import {
  login,
  loginAdmin,
  sendOtp,
  verifyOtp,
  setRole,
  providerSubmitInfo,
  upload,
  checkProviderStatus,
  providerService,
  getProviderServices,
  getServicesByCity,
  updateCustomerCity,
  searchProviders,
  sendResetPasswordOtp,
  verifyResetPasswordOtp,
  setNewPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/login-admin", loginAdmin);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/set-role", setRole);

// Provider onboarding (no services)
// router.post(
//   "/provider-submit-info",
//   protect,
//   upload.array("images", 5),
//   providerSubmitInfo
// );


router.post(
  "/provider-submit-info",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "govFront", maxCount: 1 },
    { name: "govBack", maxCount: 1 }
  ]),
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

router.post("/update-city", protect, updateCustomerCity);
router.get("/search-providers", protect, searchProviders);

router.post("/reset-password/send-otp", sendResetPasswordOtp);
router.post("/reset-password/verify-otp", verifyResetPasswordOtp);
router.post("/reset-password/set-new-password", setNewPassword);
//router.post("/reset-password/change", resetPassword);

export default router;
