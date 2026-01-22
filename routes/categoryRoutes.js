import express from "express";
import {
  addCategory,
  getAllCategories,
  getCategoryById,
  updateCategory
} from "../controllers/categoryController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ADMIN: Add category with dynamic fields
router.post("/", protect, addCategory);

// PUBLIC: get all categories
router.get("/", getAllCategories);

// PUBLIC: get category fields by categoryId
router.get("/:id", getCategoryById);

router.put("/:id", protect, updateCategory);

export default router;
