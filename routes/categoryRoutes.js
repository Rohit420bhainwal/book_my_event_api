// routes/categoryRoutes.js
import express from "express";
import { addCategory, getAllCategories } from "../controllers/categoryController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only admin can add categories (optional: protect this later)
router.post("/", protect, addCategory);

// Public endpoint for providers/customers to see available services
router.get("/", getAllCategories);

export default router;
