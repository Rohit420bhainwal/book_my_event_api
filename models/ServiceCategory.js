import mongoose from "mongoose";

const fieldSchema = new mongoose.Schema({
  key: { type: String, required: true },      // "venueType"
  label: { type: String, required: true },    // "Venue Type"
  type: { type: String, required: true },     // dropdown | number | text | list
  options: { type: [String], default: [] }    // only for dropdown
});

const serviceCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },     // "Venue"
    categoryId: { type: String, required: true, unique: true }, // "venue"
    description: { type: String },
    icon: { type: String },
    fields: [fieldSchema],                                     // DYNAMIC FIELDS HERE
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.models.ServiceCategory ||
  mongoose.model("ServiceCategory", serviceCategorySchema);
