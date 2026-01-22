// models/Provider.js
import mongoose from "mongoose";

const providerServiceSchema = new mongoose.Schema({
  serviceType: { type: String, required: true },
  description: { type: String, default: "" },
  price: { type: String, default: "" },
  images: { type: [String], default: [] },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected","suspended"],
    default: "pending",
  },
});

const providerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    businessName: { type: String, default: "" },
    contactPerson: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },

    address: { type: String, default: "" },
    city: { type: String, default: "" },

    services: [providerServiceSchema],

    onboardingComplete: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected","suspended"],
      default: "pending",
    },

    // For admin audit
    adminReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    adminReviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Provider", providerSchema);
