// models/Service.js
import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true }, // e.g. "DJ", "Catering", "Decoration"
    category: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceCategory", required: true },
    description: { type: String },
    price: { type: Number, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    images: [{ type: String }],
    peopleCapacity: { type: Number, default: null }, // 🧩 only for venue services
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

// Prevent OverwriteModelError
if (mongoose.models.Service) {
  delete mongoose.models.Service;
}

export default mongoose.model("Service", serviceSchema);
