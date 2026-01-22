// models/Service.js
import mongoose from "mongoose";

const FieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, required: true }, // e.g., number, dropdown, text
  options: { type: [String], default: [] },
});

const ServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    categoryId: { type: String, required: true },
    description: { type: String },
    icon: { type: String },
    fields: [FieldSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("ServiceCategory", ServiceSchema);
