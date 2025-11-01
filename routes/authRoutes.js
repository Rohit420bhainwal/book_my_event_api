import express from "express";
import { login,sendOtp,verifyOtp ,setRole,providerSubmitInfo, upload,checkProviderStatus} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js"; // if you have auth middleware

const router = express.Router();

// router.post("/register", register);
router.post("/login", login);

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/set-role", setRole);
router.post(
    "/provider-submit-info",
    protect,          // optional if you want to protect this route
    upload.array("images", 5), // handle max 5 images
    providerSubmitInfo
  );

  router.get("/check-provider-status/:userId", checkProviderStatus);
  
  export default router;
