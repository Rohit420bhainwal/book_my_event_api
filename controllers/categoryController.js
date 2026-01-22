import ServiceCategory from "../models/ServiceCategory.js";

// Add new category (admin only)
export const addCategory = async (req, res) => {
  try {
    const { name, categoryId, description, icon, fields } = req.body;

    if (!name || !categoryId)
      return res.status(400).json({ message: "Name & categoryId are required" });

    // check duplicate
    const existing = await ServiceCategory.findOne({ categoryId });
    if (existing)
      return res.status(400).json({ message: "Category ID already exists" });

    console.log("fields: "+fields);
    const category = await ServiceCategory.create({
      name,
      categoryId,
      description,
      icon,
      fields: fields || []
    });

    res.status(201).json({
      message: "Category added successfully",
      category
    });
  } catch (error) {
    console.error("Add Category Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Get ALL categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find({ isActive: true })
      .sort("name");

    res.status(200).json(categories);
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Get category by categoryId (important for provider dynamic forms)
export const getCategoryById = async (req, res) => {
  try {
    const cat = await ServiceCategory.findOne({
      categoryId: req.params.id
    });

    if (!cat)
      return res.status(404).json({ message: "Category not found" });

    res.status(200).json(cat);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


// Update existing category (admin only)
export const updateCategory = async (req, res) => {
  try {
    const { name, categoryId, description, icon, fields } = req.body;

    // Check if category exists
    const category = await ServiceCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // If categoryId updated → check duplicate
    if (categoryId && categoryId !== category.categoryId) {
      const exists = await ServiceCategory.findOne({ categoryId });
      if (exists) {
        return res.status(400).json({ message: "Category ID already exists" });
      }
    }

    // Update fields
    category.name = name ?? category.name;
    category.categoryId = categoryId ?? category.categoryId;
    category.description = description ?? category.description;
    category.icon = icon ?? category.icon;

    // Fields can be replaced fully
    if (fields) {
      category.fields = fields;
    }

    await category.save();

    res.status(200).json({
      message: "Category updated successfully",
      category,
    });

  } catch (error) {
    console.error("Update Category Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
