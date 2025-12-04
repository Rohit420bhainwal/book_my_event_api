import express from "express";
import { getAllProviders,getProviderById,updateProviderStatus } from "../controllers/adminController.js";
import { protect, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/providers", protect, verifyAdmin, getAllProviders);
router.get("/provider/:id", protect, verifyAdmin, getProviderById);
// Update provider status
router.put("/provider/:id/status", protect, verifyAdmin, updateProviderStatus);

export default router;
