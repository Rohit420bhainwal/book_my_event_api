import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getProfile, updateProfile } from "../controllers/profileController.js";

const router = express.Router();

// Get logged-in user's profile
router.get("/", protect, getProfile);

// Update profile (customer or provider)
router.put("/", protect, updateProfile);

export default router;
