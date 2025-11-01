// controllers/categoryController.js
import ServiceCategory from "../models/ServiceCategory.js";

// Add new category (admin only)
export const addCategory = async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    if (!name) return res.status(400).json({ message: "Category name required" });

    const existing = await ServiceCategory.findOne({ name });
    if (existing) return res.status(400).json({ message: "Category already exists" });

    const category = await ServiceCategory.create({ name, description, icon });

    res.status(201).json({ message: "Category added successfully", category });
  } catch (error) {
    console.error("Add Category Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Get all active categories (for providers to choose)
export const getAllCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ isActive: true }).sort("name");
    res.status(200).json(categories);
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
