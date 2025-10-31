// routes/providerRoutes.js
import express from "express";
import {
  getProviderProfile,
  updateProviderProfile,
} from "../controllers/providerController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", protect, getProviderProfile);
router.put("/update", protect, updateProviderProfile);

export default router;
