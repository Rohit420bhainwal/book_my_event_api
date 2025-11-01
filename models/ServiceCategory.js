// models/ServiceCategory.js
import mongoose from "mongoose";

const serviceCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // e.g. "DJ", "Catering"
    description: { type: String },
    icon: { type: String }, // optional: for frontend UI icon
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.models.ServiceCategory ||
  mongoose.model("ServiceCategory", serviceCategorySchema);
